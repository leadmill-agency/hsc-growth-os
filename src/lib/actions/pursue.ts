import type { Db } from "@/lib/db/client";
import { opportunities, accounts, projects, ploybookRuns } from "@/lib/db/schema";
import { and, count, eq, gte } from "drizzle-orm";

// Shared pursuit launcher — used by the Pursue button AND the auto-pursue
// subscription (per Rameel 2026-09-10: high-scoring discoveries shouldn't wait
// for a click; research runs automatically and the DRAFT waits in Approvals —
// the human gate moves from "start research" to "send anything").

export const AUTO_PURSUE_TRIGGER = "event:auto_pursue";

export function autoPursueThreshold(): number {
  return Number(process.env.AUTO_PURSUE_THRESHOLD ?? 75);
}

export function autoPursueDailyCap(): number {
  return Number(process.env.AUTO_PURSUE_DAILY_CAP ?? 10);
}

export async function autoPursuitsToday(db: Db): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(ploybookRuns)
    .where(
      and(
        // Any auto-triggered research run counts against the daily budget
        eq(ploybookRuns.triggerType, AUTO_PURSUE_TRIGGER),
        gte(ploybookRuns.createdAt, startOfDay)
      )
    );
  return row.n;
}

/**
 * Launch PB01 for an opportunity (executes in the caller's context — pass
 * execute=false to leave it queued for the scheduler). Returns null with a
 * reason when the opportunity isn't pursuable.
 */
export async function launchPursuit(
  db: Db,
  opportunityId: string,
  opts: { triggerType: string; initiatedBy: string }
): Promise<{ runId: string } | { runId: null; reason: string }> {
  const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, opportunityId) });
  if (!opp) return { runId: null, reason: "opportunity not found" };
  if (opp.stage !== "discovered") return { runId: null, reason: `stage is ${opp.stage}, not discovered` };
  const account = opp.accountId
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, opp.accountId) })
    : null;
  const project = opp.projectId
    ? await db.query.projects.findFirst({ where: eq(projects.id, opp.projectId) })
    : null;
  if (!account && !project) return { runId: null, reason: "no account or project to anchor on" };

  const { launchRun } = await import("@/lib/ploybooks/runner");
  await import("@/lib/ploybooks");
  const runId = await launchRun(db, {
    ploybookKey: "pb01_gc_pursuit",
    triggerType: opts.triggerType,
    triggerPayload: {
      gcName: account?.name,
      identifyOwner: !account,
      website: account?.website ?? undefined,
      projectName: project?.name,
      city: project?.city ?? undefined,
      tradeScope: opp.tradeScope ?? undefined,
      opportunityId: opp.id,
    },
    primaryEntityType: "opportunity",
    primaryEntityId: opp.id,
    initiatedBy: opts.initiatedBy,
  });
  await db
    .update(opportunities)
    .set({
      stage: "researching",
      nextAction:
        opts.triggerType === AUTO_PURSUE_TRIGGER
          ? "Auto-pursuing — draft will appear in Approvals"
          : "Research running (~5 min)",
      updatedAt: new Date(),
    })
    .where(eq(opportunities.id, opp.id));
  return { runId };
}
