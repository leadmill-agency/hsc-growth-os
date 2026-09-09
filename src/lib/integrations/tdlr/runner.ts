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
  await emitEvent(db, {
    eventType: "radar.tdlr_pulled",
    payload: { qualifying: projects.length, results },
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
