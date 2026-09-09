import type { Db } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";

// §20 — ploybook triggers subscribe to domain events. Processing is pull-based
// (scheduler tick + callable in tests) rather than inline in emitEvent, so a
// step emitting an event can never recursively launch ploybooks mid-run.
// Each event is marked processed exactly once (processedAt).

type EventRow = typeof events.$inferSelect;

const SUBSCRIPTIONS: Record<string, (db: Db, event: EventRow) => Promise<void>> = {
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
