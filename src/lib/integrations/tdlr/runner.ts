import type { Db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { emitEvent } from "@/lib/events";
import { fetchRecentHoustonProjects, formatTdlrSignal, type TdlrPullOptions } from "./client";

// Shared TDLR pull runner: used by the daily in-app scheduler, the manual UI
// button, and the CLI script. Emits radar.tdlr_pulled so the scheduler can
// check "already ran today" from the database (works across restarts/replicas).

export async function runTdlrPull(db: Db, opts: TdlrPullOptions = {}) {
  const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
  await import("@/lib/ploybooks");
  const projects = await fetchRecentHoustonProjects(opts);
  const results: { projectNumber: string; name: string; status: string }[] = [];
  for (const project of projects) {
    const { signalText, sourceUrl } = formatTdlrSignal(project);
    const runId = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerType: "scheduled",
      triggerPayload: { signalText, sourceUrl, source: "tdlr" },
      initiatedBy: "system",
    });
    const status = await executeRun(db, runId);
    results.push({ projectNumber: project.ProjectNumber, name: project.ProjectName, status });
  }

  // CoH Certificates of Occupancy ride the same daily pull (per Rameel 2026-09-10:
  // CO = business moving in, signage likely not yet bought).
  let cohCount = 0;
  try {
    const { fetchRecentOccupancyCertificates, isSignageRelevant, formatCohSignal } = await import(
      "@/lib/integrations/coh/client"
    );
    const records = (await fetchRecentOccupancyCertificates({ sinceDays: opts.sinceDays ?? 2 }))
      .filter(isSignageRelevant)
      .slice(0, 25);
    for (const record of records) {
      const { signalText, sourceUrl } = formatCohSignal(record);
      const runId = await launchRun(db, {
        ploybookKey: "pb05_opportunity_radar",
        triggerType: "scheduled",
        triggerPayload: { signalText, sourceUrl, source: "coh_co" },
        initiatedBy: "system",
      });
      const status = await executeRun(db, runId);
      results.push({ projectNumber: record.permitNumber, name: record.businessName, status });
      cohCount++;
    }
  } catch (err) {
    console.error("[radar] CoH CO pull failed (TDLR results unaffected):", err);
  }

  await emitEvent(db, {
    eventType: "radar.tdlr_pulled",
    payload: { qualifying: projects.length, cohCertificates: cohCount, results },
  });
  return results;
}

export async function tdlrPulledToday(db: Db): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await db.query.events.findFirst({
    where: and(eq(events.eventType, "radar.tdlr_pulled"), gte(events.occurredAt, startOfDay)),
  });
  return !!row;
}
