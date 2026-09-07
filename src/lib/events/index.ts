import type { Db } from "@/lib/db/client";
import { events, activities } from "@/lib/db/schema";

// §20 — every important action emits an event; §21 — every entity has chronological activity.

export interface DomainEvent {
  eventType: string;
  actor?: "system" | "user" | "integration";
  ploybookRunId?: string;
  accountId?: string;
  projectId?: string;
  opportunityId?: string;
  bidId?: string;
  proposalId?: string;
  payload?: Record<string, unknown>;
}

export async function emitEvent(db: Db, event: DomainEvent) {
  const [row] = await db
    .insert(events)
    .values({
      eventType: event.eventType,
      actor: event.actor ?? "system",
      ploybookRunId: event.ploybookRunId,
      accountId: event.accountId,
      projectId: event.projectId,
      opportunityId: event.opportunityId,
      bidId: event.bidId,
      proposalId: event.proposalId,
      payload: event.payload ?? {},
    })
    .returning();
  return row;
}

export async function logActivity(
  db: Db,
  entry: {
    entityType: string;
    entityId: string;
    action: string;
    detail?: string;
    actor?: string;
    ploybookRunId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const [row] = await db
    .insert(activities)
    .values({
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      detail: entry.detail,
      actor: entry.actor ?? "system",
      ploybookRunId: entry.ploybookRunId,
      metadata: entry.metadata ?? {},
    })
    .returning();
  return row;
}
