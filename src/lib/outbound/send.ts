import type { Db } from "@/lib/db/client";
import { approvals, interactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// The ONLY path for anything that leaves the system (email, publish, submit).
// Hard rules (master PRD §16, §33.10–11):
//   1. Refuses unless ALLOW_EXTERNAL_SEND=true (never true in dev/test).
//   2. Requires an APPROVED approval row — no approval, no send.
//   3. Idempotent per approval: a second send attempt for the same approval is refused.

export class SendBlockedError extends Error {
  constructor(reason: string) {
    super(`External send blocked: ${reason}`);
    this.name = "SendBlockedError";
  }
}

export interface OutboundMessage {
  channel: "email";
  to: string;
  subject: string;
  body: string;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
}

export type SendAdapter = (message: OutboundMessage) => Promise<{ providerId: string }>;

let adapter: SendAdapter | null = null;

export function registerSendAdapter(fn: SendAdapter | null) {
  adapter = fn;
}

/** Deliverability warm-up: cap daily sends while the new domain builds reputation. */
export function dailySendCap(): number {
  return Number(process.env.SEND_DAILY_CAP ?? 15);
}

export async function sentToday(db: Db): Promise<number> {
  const { and, count, eq, gte } = await import("drizzle-orm");
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(interactions)
    .where(
      and(
        eq(interactions.type, "email"),
        eq(interactions.direction, "outbound"),
        eq(interactions.source, "growth_os"),
        gte(interactions.occurredAt, startOfDay)
      )
    );
  return row.n;
}

export async function sendExternal(db: Db, approvalId: string, message: OutboundMessage) {
  if (process.env.ALLOW_EXTERNAL_SEND !== "true") {
    throw new SendBlockedError("ALLOW_EXTERNAL_SEND is not enabled in this environment");
  }
  if ((await sentToday(db)) >= dailySendCap()) {
    throw new SendBlockedError(
      `daily send cap (${dailySendCap()}) reached — domain warm-up limit; try tomorrow or raise SEND_DAILY_CAP`
    );
  }
  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
  if (!approval) throw new SendBlockedError(`approval ${approvalId} not found`);
  if (approval.status !== "approved" && approval.status !== "edited") {
    throw new SendBlockedError(`approval status is ${approval.status}, not approved`);
  }
  const payload = (approval.payload ?? {}) as Record<string, unknown>;
  if (payload.sentAt) {
    throw new SendBlockedError("this approval has already been used for a send");
  }
  if (!adapter) throw new SendBlockedError("no send adapter registered");

  const result = await adapter(message);

  await db
    .update(approvals)
    .set({ payload: { ...payload, sentAt: new Date().toISOString(), providerId: result.providerId } })
    .where(eq(approvals.id, approvalId));

  const [interaction] = await db
    .insert(interactions)
    .values({
      accountId: message.accountId,
      contactId: message.contactId,
      opportunityId: message.opportunityId,
      type: "email",
      direction: "outbound",
      subject: message.subject,
      summary: message.body.slice(0, 500),
      source: "growth_os",
      sourceId: result.providerId,
    })
    .returning();

  if (message.accountId) {
    await logActivity(db, {
      entityType: "account",
      entityId: message.accountId,
      action: "outreach.sent",
      detail: message.subject,
      ploybookRunId: approval.runId ?? undefined,
    });
  }
  await emitEvent(db, {
    eventType: "outreach.sent",
    accountId: message.accountId,
    opportunityId: message.opportunityId,
    ploybookRunId: approval.runId ?? undefined,
    payload: { approvalId, providerId: result.providerId },
  });

  return { interactionId: interaction.id, providerId: result.providerId };
}
