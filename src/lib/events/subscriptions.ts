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
      console.log(`[auto-pursue] daily cap reached — skipping ${event.opportunityId}`);
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
