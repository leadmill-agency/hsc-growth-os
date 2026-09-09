import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { proposals, interactions } from "@/lib/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";
import { slugify } from "./entities";

// PB14 — deal-room proposal model + engagement tracking.
// Pricing is NEVER model-generated: price fields stay null until a human sets them,
// and the public page shows "pricing pending" until then.

export const dealRoomContentSchema = z.object({
  headline: z.string(),
  project_summary: z.string(),
  scope_items: z.array(z.object({ item: z.string(), detail: z.string() })),
  timeline_note: z.string(),
  warranty_note: z.string(),
  exclusions: z.array(z.string()),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  next_step: z.string(),
});

export type DealRoomContent = z.infer<typeof dealRoomContentSchema>;

export async function createProposalDraft(
  db: Db,
  params: {
    opportunityId: string;
    name: string;
    content: DealRoomContent;
    ploybookRunId?: string;
  }
) {
  const existing = await db.query.proposals.findFirst({
    where: eq(proposals.opportunityId, params.opportunityId),
  });
  if (existing) {
    const [updated] = await db
      .update(proposals)
      .set({ version: existing.version + 1, status: "draft" })
      .where(eq(proposals.id, existing.id))
      .returning();
    return { proposal: updated, content: params.content, created: false as const };
  }
  const [proposal] = await db
    .insert(proposals)
    .values({
      opportunityId: params.opportunityId,
      slug: `${slugify(params.name)}-${randomBytes(3).toString("hex")}`,
      publicToken: randomBytes(16).toString("hex"),
      status: "draft",
    })
    .returning();
  return { proposal, content: params.content, created: true as const };
}

export async function publishProposal(db: Db, proposalId: string) {
  const [proposal] = await db
    .update(proposals)
    .set({ status: "published" })
    .where(eq(proposals.id, proposalId))
    .returning();
  await emitEvent(db, {
    eventType: "proposal.published",
    proposalId: proposal.id,
    opportunityId: proposal.opportunityId ?? undefined,
    payload: {},
  });
  return proposal;
}

/**
 * Record one deal-room view: counter, interaction, event — and the PB14 intent
 * trigger: 3+ views inside 24h emits proposal.high_engagement for sales follow-up.
 */
export async function recordProposalView(db: Db, token: string) {
  const proposal = await db.query.proposals.findFirst({
    where: eq(proposals.publicToken, token),
  });
  if (!proposal || proposal.status !== "published") return null;
  await db
    .update(proposals)
    .set({ viewCount: sql`${proposals.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(proposals.id, proposal.id));
  await db.insert(interactions).values({
    opportunityId: proposal.opportunityId,
    type: "proposal_view",
    direction: "inbound",
    subject: `Deal room viewed (v${proposal.version})`,
    source: "deal_room",
    sourceId: proposal.id,
  });
  await emitEvent(db, {
    eventType: "proposal.viewed",
    proposalId: proposal.id,
    opportunityId: proposal.opportunityId ?? undefined,
    payload: { viewCount: proposal.viewCount + 1 },
  });
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const recentViews = await db.query.interactions.findMany({
    where: and(
      eq(interactions.sourceId, proposal.id),
      eq(interactions.type, "proposal_view"),
      gte(interactions.occurredAt, dayAgo)
    ),
  });
  if (recentViews.length === 3 && proposal.opportunityId) {
    await emitEvent(db, {
      eventType: "proposal.high_engagement",
      proposalId: proposal.id,
      opportunityId: proposal.opportunityId,
      payload: { viewsIn24h: recentViews.length },
    });
    await logActivity(db, {
      entityType: "opportunity",
      entityId: proposal.opportunityId,
      action: "proposal.high_engagement",
      detail: "3+ deal-room views in 24h — follow up now",
    });
  }
  return proposal;
}
