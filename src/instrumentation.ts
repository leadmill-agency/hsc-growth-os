// In-app scheduler (runs once per server process, master PRD §8 durable-enough MVP).
// Enabled only when ENABLE_SCHEDULER=true (set on Railway; off in dev/tests).
// Every 15 minutes: after 13:00 UTC (~7-8am Houston), run the daily TDLR radar
// pull unless the database says it already ran today (restart/replica safe).
// A dedicated Railway cron service is the cleaner future home once jobs multiply.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_SCHEDULER !== "true") return;

  const tick = async () => {
    const { getDb } = await import("@/lib/db/client");
    const db = await getDb();

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
  void tick();
  console.log("[scheduler] enabled (events, follow-ups, TDLR daily pull)");
}
