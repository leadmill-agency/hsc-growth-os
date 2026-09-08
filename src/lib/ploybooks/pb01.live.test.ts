import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDb, resetDbForTests } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { ploybookRuns, ploybookSteps, approvals } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

// LIVE smoke test — real OpenAI research + structured extraction. Costs real money.
// Runs only with LIVE=1 (never in CI). Reads OPENAI_API_KEY from .env directly.

const live = process.env.LIVE === "1";

describe.skipIf(!live)("PB01 live (OpenAI)", () => {
  it("runs research → outreach draft → approval gate against the real APIs", async () => {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) process.env[m[1]] = m[2];
    }
    resetDbForTests();
    const db = await getDb();

    const runId = await launchRun(db, {
      ploybookKey: "pb01_gc_pursuit",
      triggerPayload: {
        gcName: "Harvey-Cleary Builders",
        website: "https://www.harveycleary.com",
        projectName: "University of Houston campus project",
        city: "Houston",
        tradeScope: "signage/wayfinding",
      },
    });
    const status = await executeRun(db, runId);

    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    for (const s of steps) {
      console.log(`STEP ${s.stepKey}: ${s.status}${s.error ? ` — ${s.error}` : ""}`);
    }
    const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
    console.log("RUN:", run?.status, run?.error ?? "");

    const approval = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    if (approval) {
      console.log("APPROVAL:", approval.title);
      console.log(JSON.stringify(approval.payload, null, 2).slice(0, 2000));
    }
    expect(status).toBe("waiting_for_approval");
  }, 600000);
});
