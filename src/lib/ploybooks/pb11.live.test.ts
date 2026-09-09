import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { getDb, resetDbForTests } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { ploybookSteps, approvals, documents } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

// LIVE PB11 test against the real Rooms To Go Baytown package. Costs real money;
// LIVE=1 only, never CI. Grades the analyzer against a package whose right answer
// (canopy scope in spec 10538 + canopy sheets) is known.

const live = process.env.LIVE === "1";
const RTG_FOLDER = process.env.PB11_FOLDER ?? "/Users/rameel/Desktop/Rooms To Go - Baytown";

describe.skipIf(!live)("PB11 live (real RTG package)", () => {
  it("ingests the full package and produces a real estimator brief + supplier RFQs", async () => {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
    resetDbForTests();
    const db = await getDb();

    const runId = await launchRun(db, {
      ploybookKey: "pb11_bid_analyzer",
      triggerPayload: { folderPath: RTG_FOLDER, projectName: process.env.PB11_PROJECT ?? "Rooms To Go - Baytown (C.A. Walker)" },
    });
    const status = await executeRun(db, runId);

    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    for (const s of steps) {
      console.log(`STEP ${s.stepKey}: ${s.status}${s.error ? ` — ${s.error}` : ""}`);
      if (s.stepKey === "ingest_documents") {
        const out = s.outputs as { totalIngested: number; byType: Record<string, number>; relevant: { filename: string; relevanceReason: string | null }[] };
        console.log(`  ingested ${out.totalIngested}:`, JSON.stringify(out.byType));
        console.log(`  relevant:`, out.relevant.map((r) => `${r.filename} [${r.relevanceReason}]`).join(" | "));
      }
      if (s.stepKey === "estimator_brief" && s.status === "completed") {
        console.log("BRIEF:", JSON.stringify(s.outputs, null, 1).slice(0, 3500));
      }
    }
    const approval = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });

    const report = {
      status,
      steps: steps.map((s) => ({ key: s.stepKey, status: s.status, error: s.error, outputs: s.outputs })),
      rfqApproval: approval?.payload ?? null,
      documentRows: (await db.select().from(documents)).length,
    };
    writeFileSync(
      process.env.PB11_REPORT ?? "/tmp/pb11-live-report.json",
      JSON.stringify(report, null, 1)
    );
    expect(["waiting_for_approval", "completed"]).toContain(status);
  }, 900000);
});
