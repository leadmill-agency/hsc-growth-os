// In-app scheduler (runs once per server process, master PRD §8 durable-enough MVP).
// Enabled only when ENABLE_SCHEDULER=true (set on Railway; off in dev/tests).
// Every 15 minutes: after 13:00 UTC (~7-8am Houston), run the daily TDLR radar
// pull unless the database says it already ran today (restart/replica safe).
// A dedicated Railway cron service is the cleaner future home once jobs multiply.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Outbound email adapter (htxsigncrafters.com via Resend). Registering the
  // adapter does NOT enable sending — the guarded layer still requires
  // ALLOW_EXTERNAL_SEND=true and an approved, unused approval per message.
  try {
    const { registerResendAdapterIfConfigured } = await import("@/lib/outbound/resend-adapter");
    if (registerResendAdapterIfConfigured()) console.log("[outbound] Resend adapter registered");
  } catch (err) {
    console.error("[outbound] adapter registration failed:", err);
  }

  if (process.env.ENABLE_SCHEDULER !== "true") return;

  // Boot sweep: a fresh process means every "running" run died with the old one
  // (deploys restart the server mid-research otherwise silently stranding runs).
  const bootSweep = async () => {
    try {
      const { getDb } = await import("@/lib/db/client");
      const db = await getDb();
      const { resumeOrphanedRuns } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const resumed = await resumeOrphanedRuns(db, {
        runningOlderThanMs: 0,
        queuedOlderThanMs: 2 * 60 * 1000,
      });
      if (resumed) console.log(`[scheduler] auto-resumed ${resumed} orphaned run(s) after boot`);
    } catch (err) {
      console.error("[scheduler] boot sweep failed:", err);
    }
  };

  const tick = async () => {
    const { getDb } = await import("@/lib/db/client");
    const db = await getDb();

    // Steady-state orphan pickup: queued runs nobody executed (e.g. PB10's child
    // analysis), and running runs stale for 30+ min (crashed handler).
    try {
      const { resumeOrphanedRuns } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const resumed = await resumeOrphanedRuns(db, {
        runningOlderThanMs: 30 * 60 * 1000,
        queuedOlderThanMs: 2 * 60 * 1000,
      });
      if (resumed) console.log(`[scheduler] auto-resumed ${resumed} orphaned run(s)`);
    } catch (err) {
      console.error("[scheduler] orphan pickup failed:", err);
    }

    // §20 event subscriptions (e.g. bid.submitted → PB13 follow-up plan)
    try {
      const { processEvents } = await import("@/lib/events/subscriptions");
      const handled = await processEvents(db);
      if (handled) console.log(`[scheduler] processed ${handled} event(s)`);
    } catch (err) {
      console.error("[scheduler] event processing failed:", err);
    }

    // PB13: draft due bid follow-ups into the approvals inbox
    try {
      const { processDueFollowups } = await import("@/lib/ploybooks/pb13-bid-followup/definition");
      const drafted = await processDueFollowups(db);
      if (drafted) console.log(`[scheduler] drafted ${drafted} due follow-up(s)`);
    } catch (err) {
      console.error("[scheduler] follow-up drafting failed:", err);
    }

    // PB18 weekly brief — Monday after Houston morning
    try {
      const now = new Date();
      if (now.getUTCDay() === 1 && now.getUTCHours() >= 13) {
        const { pb18RanThisWeek } = await import("@/lib/ploybooks/pb18-growth-operator/definition");
        if (!(await pb18RanThisWeek(db))) {
          const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
          await import("@/lib/ploybooks");
          console.log("[scheduler] running weekly PB18 growth brief");
          const runId = await launchRun(db, {
            ploybookKey: "pb18_growth_operator",
            triggerType: "scheduled",
            initiatedBy: "system",
          });
          await executeRun(db, runId);
        }
      }
    } catch (err) {
      console.error("[scheduler] weekly brief failed:", err);
    }

    // Daily TDLR radar pull (after Houston morning)
    try {
      const hourUtc = new Date().getUTCHours();
      if (hourUtc < 13) return;
      const { tdlrPulledToday, runTdlrPull } = await import("@/lib/integrations/tdlr/runner");
      if (await tdlrPulledToday(db)) return;
      console.log("[scheduler] running daily TDLR pull");
      const results = await runTdlrPull(db);
      console.log(`[scheduler] TDLR pull done: ${results.length} qualifying filings`);
    } catch (err) {
      console.error("[scheduler] TDLR pull failed:", err);
    }
  };

  setInterval(tick, 15 * 60 * 1000);
  void bootSweep().then(() => tick());
  console.log("[scheduler] enabled (orphan resume, events, follow-ups, TDLR daily pull)");
}
