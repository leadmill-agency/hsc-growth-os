import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import { approvals } from "@/lib/db/schema";
import { registerSendAdapter, sendExternal, SendBlockedError } from "./send";

let db: Db;

async function makeApproval(status: string) {
  const [row] = await db
    .insert(approvals)
    .values({ approvalType: "send_outreach", title: "Send test email", status })
    .returning();
  return row;
}

const message = {
  channel: "email" as const,
  to: "test@example.com",
  subject: "Test",
  body: "Body",
};

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  registerSendAdapter(null);
  delete process.env.ALLOW_EXTERNAL_SEND;
});

describe("guarded send layer", () => {
  it("refuses to send when ALLOW_EXTERNAL_SEND is not true (the dev/test invariant)", async () => {
    const approval = await makeApproval("approved");
    await expect(sendExternal(db, approval.id, message)).rejects.toThrow(SendBlockedError);
  });

  it("refuses to send without an approved approval", async () => {
    process.env.ALLOW_EXTERNAL_SEND = "true";
    const pending = await makeApproval("pending");
    await expect(sendExternal(db, pending.id, message)).rejects.toThrow(/not approved/);
    const rejected = await makeApproval("rejected");
    await expect(sendExternal(db, rejected.id, message)).rejects.toThrow(/not approved/);
  });

  it("sends once per approval and refuses the second attempt (idempotency)", async () => {
    process.env.ALLOW_EXTERNAL_SEND = "true";
    let calls = 0;
    registerSendAdapter(async () => ({ providerId: `msg_${++calls}` }));
    const approval = await makeApproval("approved");
    const result = await sendExternal(db, approval.id, message);
    expect(result.providerId).toBe("msg_1");
    await expect(sendExternal(db, approval.id, message)).rejects.toThrow(/already been used/);
    expect(calls).toBe(1);
  });
});
