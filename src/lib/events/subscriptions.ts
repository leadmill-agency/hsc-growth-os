import type { Db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";

// §20 — ploybook triggers subscribe to domain events. Processing is pull-based
// (scheduler tick + callable in tests) rather than inline in emitEvent, so a
// step emitting an event can never recursively launch ploybooks mid-run.
// Each event is marked processed exactly once (processedAt).

type EventRow = typeof events.$inferSelect;

const SUBSCRIPTIONS: Record<string, (db: Db, event: EventRow) => Promise<void>> = {
  // Auto-pursue (per Rameel 2026-09-10): a discovered opportunity scoring at or
  // above the threshold gets researched WITHOUT waiting for a click — the human
  // gate is the Approvals inbox, not the Pursue button. Daily cap bounds cost.
  "opportunity.discovered": async (db, event) => {
    if (!event.opportunityId) return;
    const payload = event.payload as { score?: number; suggestedPloybook?: string };
    const { autoPursueThreshold, autoPursueDailyCap, autoPursuitsToday, launchPursuit, AUTO_PURSUE_TRIGGER } =
      await import("@/lib/actions/pursue");
    if ((payload.score ?? 0) < autoPursueThreshold()) return;
    if ((await autoPursuitsToday(db)) >= autoPursueDailyCap()) {
      // Out of budget today — put the event back so tomorrow's tick retries it
      // instead of silently dropping a 75+ lead (it kept its Pursue button and
      // nobody could tell why it was never researched).
      await db.update(events).set({ processedAt: null }).where(eq(events.id, event.id));
      console.log(`[auto-pursue] daily cap reached — deferred ${event.opportunityId} to tomorrow`);
      return;
    }

    // Franchise/development/portfolio suggestions auto-route to their research
    // playbook (PB02/03/04 are research-only: entities + strategic score +
    // recommendation; any outreach still gates through Approvals later).
    const suggested = payload.suggestedPloybook;
    if (suggested === "pb02" || suggested === "pb03" || suggested === "pb04") {
      const { opportunities, accounts, projects, ploybookRuns } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const opp = await db.query.opportunities.findFirst({
        where: eq(opportunities.id, event.opportunityId),
      });
      if (!opp || opp.stage !== "discovered") return;
      const account = opp.accountId
        ? await db.query.accounts.findFirst({ where: eq(accounts.id, opp.accountId) })
        : null;
      const project = opp.projectId
        ? await db.query.projects.findFirst({ where: eq(projects.id, opp.projectId) })
        : null;
      const config =
        suggested === "pb03"
          ? account && { key: "pb03_franchise_expansion", payload: { brandName: account.name } }
          : suggested === "pb04"
            ? account && { key: "pb04_facility_portfolio", payload: { operatorName: account.name } }
            : (project || account) && {
                key: "pb02_commercial_development",
                payload: {
                  developmentName: project?.name ?? account!.name,
                  city: project?.city ?? undefined,
                },
              };
      if (!config) return;
      const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
      await import("@/lib/ploybooks");
      const runId = await launchRun(db, {
        ploybookKey: config.key,
        triggerType: AUTO_PURSUE_TRIGGER,
        triggerPayload: config.payload,
        primaryEntityType: "opportunity",
        primaryEntityId: opp.id,
        initiatedBy: "system",
      });
      await db
        .update(opportunities)
        .set({ stage: "researching", nextAction: "Auto-researching (see run)", updatedAt: new Date() })
        .where(eq(opportunities.id, opp.id));
      await executeRun(db, runId);
      // PB02/03/04 have no finalize step of their own — land the card in the
      // Researched tab once the run is done.
      await db
        .update(opportunities)
        .set({ stage: "researched", nextAction: "Research ready — review in Researched", updatedAt: new Date() })
        .where(eq(opportunities.id, opp.id));
      void ploybookRuns; // schema import kept for future run-count guards
      return;
    }

    const result = await launchPursuit(db, event.opportunityId, {
      triggerType: AUTO_PURSUE_TRIGGER,
      initiatedBy: "system",
    });
    if (result.runId) {
      const { executeRun } = await import("@/lib/ploybooks/runner");
      await executeRun(db, result.runId);
    }
  },
  // Every submitted bid gets a follow-up plan until the outcome is known (PB13).
  "bid.submitted": async (db, event) => {
    if (!event.bidId) return;
    const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
    await import("@/lib/ploybooks");
    const runId = await launchRun(db, {
      ploybookKey: "pb13_bid_followup",
      triggerType: "event:bid.submitted",
      triggerPayload: { bidId: event.bidId, opportunityId: event.opportunityId ?? undefined },
      initiatedBy: "system",
    });
    await executeRun(db, runId);
  },
};

/** Process unhandled events once. Returns how many were processed. */
export async function processEvents(db: Db): Promise<number> {
  const pending = await db.query.events.findMany({
    where: isNull(events.processedAt),
    orderBy: asc(events.occurredAt),
    limit: 50,
  });
  let handled = 0;
  for (const event of pending) {
    // Claim first so a crash mid-handler can't double-launch on the next tick.
    const [claimed] = await db
      .update(events)
      .set({ processedAt: new Date() })
      .where(and(eq(events.id, event.id), isNull(events.processedAt)))
      .returning();
    if (!claimed) continue;
    const handler = SUBSCRIPTIONS[event.eventType];
    if (!handler) continue;
    try {
      await handler(db, event);
      handled++;
    } catch (err) {
      console.error(`[events] handler failed for ${event.eventType} ${event.id}:`, err);
    }
  }
  return handled;
}
