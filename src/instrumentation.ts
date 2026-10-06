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

  // Boot sweep: after a deploy, "running" runs that died with the old process
  // need picking up. NOT instantly (2026-09-18): scripts also execute runs
  // against the same database from outside this process, and a boot sweep that
  // grabs every running run stole one mid-draft and produced duplicate
  // approvals. Runs heartbeat updatedAt at each step start, so 10 minutes of
  // staleness means genuinely dead, not just a slow step elsewhere.
  const bootSweep = async () => {
    try {
      const { getDb } = await import("@/lib/db/client");
      const db = await getDb();
      const { resumeOrphanedRuns } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const resumed = await resumeOrphanedRuns(db, {
        runningOlderThanMs: 10 * 60 * 1000,
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
    // analysis), and running runs 15+ min stale (crashed handler or killed by a
    // deploy mid-step — updatedAt refreshes at each step start, so only a
    // single step stuck longer than this trips it).
    try {
      const { resumeOrphanedRuns } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const resumed = await resumeOrphanedRuns(db, {
        runningOlderThanMs: 15 * 60 * 1000,
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

    // PB18 daily brief — every morning after the radar pulls (per Rameel 2026-09-10)
    try {
      const now = new Date();
      if (now.getUTCHours() >= 13) {
        const { pb18RanToday } = await import("@/lib/ploybooks/pb18-growth-operator/definition");
        const { tdlrPulledToday } = await import("@/lib/integrations/tdlr/runner");
        // Brief only after the day's intake has run, so it reports on fresh data
        if (!(await pb18RanToday(db)) && (await tdlrPulledToday(db))) {
          const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
          await import("@/lib/ploybooks");
          console.log("[scheduler] running daily PB18 growth brief");
          const runId = await launchRun(db, {
            ploybookKey: "pb18_growth_operator",
            triggerType: "scheduled",
            initiatedBy: "system",
          });
          await executeRun(db, runId);
        }
      }
    } catch (err) {
      console.error("[scheduler] daily brief failed:", err);
    }

    // Daily TDLR + CoH radar pull (after Houston morning)
    try {
      const hourUtc = new Date().getUTCHours();
      if (hourUtc >= 13) {
        const { tdlrPulledToday, runTdlrPull } = await import("@/lib/integrations/tdlr/runner");
        if (!(await tdlrPulledToday(db))) {
          console.log("[scheduler] running daily TDLR+CoH pull");
          const results = await runTdlrPull(db);
          console.log(`[scheduler] TDLR+CoH pull done: ${results.length} signals`);
        }
      }
    } catch (err) {
      console.error("[scheduler] TDLR pull failed:", err);
    }

    // Contacts on researched companies get their Apollo/Hunter lookup
    // automatically — a few per tick, once per contact. Companies where nobody
    // is reachable get an Apollo people SEARCH first (who runs real estate/
    // construction there), then the reveal.
    try {
      const { enrichResearchedContacts, discoverContactsForUncovered } = await import(
        "@/lib/actions/contact-enrichment"
      );
      const discovered = await discoverContactsForUncovered(db);
      if (discovered) console.log(`[scheduler] discovered ${discovered} decision-maker(s) via Apollo`);
      const found = await enrichResearchedContacts(db);
      if (found) console.log(`[scheduler] enriched ${found} contact email(s)`);
      const { autoDismissUnreachable } = await import("@/lib/actions/contact-enrichment");
      const closed = await autoDismissUnreachable(db);
      if (closed) console.log(`[scheduler] auto-dismissed ${closed} unreachable card(s)`);
    } catch (err) {
      console.error("[scheduler] contact enrichment failed:", err);
    }

    // One-off cards idle 7 days quietly archive (rollouts and pinned never do)
    try {
      const { archiveStaleOneOffs } = await import("@/lib/actions/archive-sweep");
      const archived = await archiveStaleOneOffs(db);
      if (archived) console.log(`[scheduler] archived ${archived} stale one-off card(s)`);
    } catch (err) {
      console.error("[scheduler] archive sweep failed:", err);
    }

    // Weekly SEO + content scan (per Rameel 2026-09-18): Mondays after the
    // morning intake, PB16 drafts one city × product page and PB17 one buyer-
    // question article. "Due" is week-based, so a Monday outage just means the
    // scan runs on the next tick instead of skipping the week.
    try {
      const hourUtc = new Date().getUTCHours();
      if (hourUtc >= 13) {
        const { weeklySeoScanDue, runWeeklySeoScan } = await import("@/lib/integrations/seo-scan/weekly");
        if (await weeklySeoScanDue(db)) {
          console.log("[scheduler] running weekly SEO + content scan");
          for (const line of await runWeeklySeoScan(db)) console.log(`[scheduler] ${line}`);
        }
      }
    } catch (err) {
      console.error("[scheduler] weekly SEO scan failed:", err);
    }

    // Daily web Expansion Scout (franchises/developments/operators — radar PRD §5).
    // PAUSED (Rameel 2026-10-01): franchise cold email got 0 replies in 35
    // sends. Set SCOUT_ENABLED=true to bring it back.
    try {
      const hourUtc = new Date().getUTCHours();
      if (hourUtc >= 13 && process.env.SCOUT_ENABLED === "true") {
        const { scoutRanToday, runExpansionScout } = await import("@/lib/integrations/scout/client");
        if (!(await scoutRanToday(db))) {
          console.log("[scheduler] running daily expansion scout");
          const found = await runExpansionScout(db);
          console.log(`[scheduler] scout done: ${found.length} discoveries fed to radar`);
        }
      }
    } catch (err) {
      console.error("[scheduler] expansion scout failed:", err);
    }
  };

  // Texas repeat-buyer outreach (Rameel 2026-10-01): weekday mornings, build a
  // batch of new contractors / property managers / developers / architects
  // from Apollo and draft email 1 into the Outbox; draft due follow-ups every
  // tick. Nothing sends without approval. OUTREACH_ENABLED gates it.
  const outreachTick = async () => {
    if (process.env.OUTREACH_ENABLED !== "true") return;
    try {
      const { getDb } = await import("@/lib/db/client");
      const db = await getDb();
      const prospecting = await import("@/lib/outbound/prospecting");
      const now = new Date();
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" }).format(now);
      if (now.getUTCHours() >= 13 && !["Sat", "Sun"].includes(weekday) && !(await prospecting.outreachBatchBuiltToday(db))) {
        console.log("[outreach] building today's Texas outreach batch");
        const r = await prospecting.buildDailyOutreachBatch(db);
        console.log(`[outreach] batch: ${JSON.stringify(r.created)} (${r.reveals} reveals${r.quotaHit ? ", Apollo quota hit" : ""})`);
      }
      const drafted = await prospecting.draftDueSequenceFollowups(db);
      if (drafted) console.log(`[outreach] drafted ${drafted} follow-up(s)`);
    } catch (err) {
      console.error("[outreach] tick failed:", err);
    }
  };
  setInterval(outreachTick, 15 * 60 * 1000);
  setTimeout(outreachTick, 2 * 60 * 1000);

  // Minute-level send-queue tick: queued emails deliver 9:00am–5:30pm Houston
  // time, ~5 minutes apart (Rameel 2026-09-21) — needs finer granularity than
  // the 15-minute tick. One cheap query when the queue is empty.
  const sendQueueTick = async () => {
    try {
      const { getDb } = await import("@/lib/db/client");
      const db = await getDb();
      const { processSendQueue } = await import("@/lib/outbound/send-queue");
      const sent = await processSendQueue(db);
      if (sent) console.log(`[send-queue] delivered ${sent} queued email(s)`);
      // Queued runs start ONE per minute (Rameel 2026-09-21): rapid Pursues
      // become a 1/min drip instead of a parallel burst that trips OpenAI's
      // token-per-minute ceiling. Also speeds up PB10 child-run pickup.
      const { resumeOrphanedRuns } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const started = await resumeOrphanedRuns(db, {
        runningOlderThanMs: 15 * 60 * 1000,
        queuedOlderThanMs: 30 * 1000,
        limit: 1,
      });
      if (started) console.log(`[run-queue] started 1 queued run`);
    } catch (err) {
      console.error("[send-queue] tick failed:", err);
    }
  };
  setInterval(sendQueueTick, 60 * 1000);

  setInterval(tick, 15 * 60 * 1000);
  void bootSweep().then(() => tick());
  console.log("[scheduler] enabled (orphan resume, events, follow-ups, TDLR daily pull)");
}
