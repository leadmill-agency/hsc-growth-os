import { z } from "zod";
import type { Db } from "@/lib/db/client";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { bids, followups, opportunities, accounts, approvals } from "@/lib/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB13 — Bid Follow-Up / Award Watch: every submitted bid is tracked until an
// outcome is known. Launched automatically by the bid.submitted subscription.
// Cadence (PRD default, days after submission): 2 receipt, 7 status, 14 follow-up,
// 30 award check. Due follow-ups are drafted by the scheduler and land in the
// approvals inbox; sending stays human.

export const FOLLOWUP_CADENCE: { kind: string; days: number }[] = [
  { kind: "receipt_confirmation", days: 2 },
  { kind: "status_followup", days: 7 },
  { kind: "followup", days: 14 },
  { kind: "award_check", days: 30 },
];

export const pb13BidFollowup: PloybookDefinition = {
  key: "pb13_bid_followup",
  name: "PB13 — Bid Follow-Up / Award Watch",
  description:
    "Creates the Day 2/7/14/30 follow-up plan for a submitted bid; the scheduler drafts each follow-up when due and routes it to the approvals inbox. Tracks until award outcome is known.",
  version: "1.0",
  triggerTypes: ["event:bid.submitted", "manual"],
  steps: [
    {
      key: "create_plan",
      name: "Create follow-up plan",
      async run(ctx) {
        const p = ctx.triggerPayload as { bidId?: string };
        if (!p.bidId) throw new Error("bidId is required");
        const bid = await ctx.db.query.bids.findFirst({ where: eq(bids.id, p.bidId) });
        if (!bid) throw new Error(`Bid not found: ${p.bidId}`);
        const base = bid.submittedAt ?? new Date();
        // Idempotent: a re-run must not duplicate the plan.
        const existing = await ctx.db.query.followups.findMany({
          where: eq(followups.bidId, p.bidId),
        });
        if (existing.length > 0) {
          return { kind: "completed", outputs: { followupIds: existing.map((f) => f.id), deduped: true } };
        }
        const ids: string[] = [];
        for (const step of FOLLOWUP_CADENCE) {
          const [row] = await ctx.db
            .insert(followups)
            .values({
              bidId: p.bidId,
              opportunityId: bid.opportunityId,
              kind: step.kind,
              dueAt: new Date(base.getTime() + step.days * 24 * 3600 * 1000),
            })
            .returning();
          ids.push(row.id);
        }
        await logActivity(ctx.db, {
          entityType: "bid",
          entityId: p.bidId,
          action: "followup.plan_created",
          detail: `Day ${FOLLOWUP_CADENCE.map((c) => c.days).join("/")} cadence`,
          ploybookRunId: ctx.runId,
        });
        await emitEvent(ctx.db, {
          eventType: "bid.followup_plan_created",
          bidId: p.bidId,
          opportunityId: bid.opportunityId ?? undefined,
          ploybookRunId: ctx.runId,
          payload: { followupCount: ids.length },
        });
        return { kind: "completed", outputs: { followupIds: ids } };
      },
    },
  ],
};

const followupDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

/**
 * Scheduler hook: draft every due pending follow-up and route it to the approvals
 * inbox. A cancelled bid outcome cancels its remaining follow-ups.
 */
export async function processDueFollowups(db: Db): Promise<number> {
  const due = await db.query.followups.findMany({
    where: and(eq(followups.status, "pending"), lte(followups.dueAt, new Date())),
    limit: 10,
  });
  let drafted = 0;
  for (const followup of due) {
    const bid = followup.bidId
      ? await db.query.bids.findFirst({ where: eq(bids.id, followup.bidId) })
      : null;
    // Outcome already known → no more chasing.
    if (bid && ["won", "lost", "cancelled", "passed"].includes(bid.status)) {
      await db
        .update(followups)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(followups.id, followup.id));
      continue;
    }
    const opportunity = followup.opportunityId
      ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, followup.opportunityId) })
      : null;
    const account = opportunity?.accountId
      ? await db.query.accounts.findFirst({ where: eq(accounts.id, opportunity.accountId) })
      : null;

    const llm = getLLMClient();
    const draft = await llm.generateStructured({
      system:
        "Draft a short bid follow-up email for Houston Sign Crafters to a GC. ≤80 words, " +
        "plain English, one question, no pressure tactics, no invented facts. Tone matches " +
        "the follow-up kind: receipt_confirmation politely confirms the bid arrived; " +
        "status_followup/followup ask where the package stands; award_check asks if the " +
        "award decision has been made and, if lost, who won (we always want to know).",
      prompt:
        `Follow-up kind: ${followup.kind}\n` +
        `Opportunity: ${opportunity?.name ?? "unknown"}\n` +
        `GC: ${account?.name ?? "unknown"}\n` +
        `Bid submitted: ${bid?.submittedAt?.toISOString() ?? "unknown"}\n` +
        `Bid due date was: ${bid?.dueAt?.toISOString() ?? "unknown"}\n\nDraft the email.`,
      schema: followupDraftSchema,
      effort: "low",
    });

    const [approval] = await db
      .insert(approvals)
      .values({
        approvalType: "send_followup",
        title: `Bid follow-up (${followup.kind}): ${opportunity?.name ?? followup.bidId}`,
        summary: "Scheduler-drafted follow-up. Approve when sent (sending stays manual for now).",
        proposedAction: draft.subject,
        payload: { followupId: followup.id, draft },
      })
      .returning();
    await db
      .update(followups)
      .set({ status: "drafted", draft, approvalId: approval.id, updatedAt: new Date() })
      .where(eq(followups.id, followup.id));
    if (followup.bidId) {
      await logActivity(db, {
        entityType: "bid",
        entityId: followup.bidId,
        action: "followup.drafted",
        detail: `${followup.kind} → approvals inbox`,
      });
    }
    drafted++;
  }
  return drafted;
}
