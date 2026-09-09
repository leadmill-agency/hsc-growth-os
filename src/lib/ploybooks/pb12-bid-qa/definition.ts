import type { PloybookDefinition } from "../types";
import { bids } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB12 — Bid QA + Submission: prevent avoidable administrative bid failures.
// Trigger payload: { bidId, checkedItems?: string[] }
// Deterministic checklist (PB12 PRD) + Jamal-specific item: supplier quotes received.
// Output READY / NOT READY with blockers; the human submits; the system logs it.

export const QA_CHECKLIST_ITEMS = [
  "base bid amount complete",
  "alternates complete (or explicitly N/A)",
  "all addenda acknowledged",
  "bid/proposal form complete",
  "exclusions stated",
  "unit prices complete (if requested)",
  "schedule/lead times stated",
  "supplier quotes received (awnings/canopies/backlit)",
  "tax status correct",
  "bond included (if required)",
  "W-9 attached",
  "COI attached",
  "certifications attached (if required)",
  "signature",
  "submission method confirmed (portal/email)",
  "deadline margin (submitting before internal due date)",
] as const;

export const pb12BidQa: PloybookDefinition = {
  key: "pb12_bid_qa",
  name: "PB12 — Bid QA + Submission",
  description:
    "Runs the pre-submission checklist (READY/NOT READY with blockers, including supplier quotes received), gates submission behind approval, and logs the actual submission.",
  version: "1.0",
  triggerTypes: ["manual", "event:bid.ready_for_qa"],
  steps: [
    {
      key: "build_checklist",
      name: "Build QA checklist",
      async run(ctx) {
        const p = ctx.triggerPayload as { bidId?: string; checkedItems?: string[] };
        if (!p.bidId) throw new Error("bidId is required");
        const bid = await ctx.db.query.bids.findFirst({ where: eq(bids.id, p.bidId) });
        if (!bid) throw new Error(`Bid not found: ${p.bidId}`);
        const checked = new Set((p.checkedItems ?? []).map((s) => s.toLowerCase()));
        const items: { item: string; status: "done" | "open" }[] = QA_CHECKLIST_ITEMS.map((item) => ({
          item,
          status: checked.has(item.toLowerCase()) ? ("done" as const) : ("open" as const),
        }));
        // Deadline check is computed, not self-reported.
        const deadlineItem = items.find((i) => i.item.startsWith("deadline margin"));
        if (deadlineItem && bid.dueAt && Date.now() > bid.dueAt.getTime()) {
          deadlineItem.status = "open";
          items.push({ item: "BID DUE DATE HAS PASSED", status: "open" });
        }
        const blockers = items.filter((i) => i.status === "open").map((i) => i.item);
        const ready = blockers.length === 0;
        return {
          kind: "completed",
          outputs: { bidId: p.bidId, items, blockers, ready, dueAt: bid.dueAt?.toISOString() ?? null },
        };
      },
    },
    {
      key: "submission_approval",
      name: "Submission gate",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const checklist = ctx.priorOutputs["build_checklist"];
          const ready = checklist.ready as boolean;
          const blockers = checklist.blockers as string[];
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "submit_bid",
              title: ready ? "Bid QA: READY to submit" : `Bid QA: NOT READY — ${blockers.length} blocker(s)`,
              summary: ready
                ? "All checklist items pass. Approving records that a human submitted the bid — the system never submits."
                : `Open items: ${blockers.join("; ")}`,
              proposedAction:
                "Approve ONLY after you have actually submitted the bid (portal/email). Reject to keep the bid open.",
              payload: { checklist: checklist.items, blockers, ready },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "record_submission",
      name: "Record submission",
      async run(ctx) {
        const p = ctx.triggerPayload as { bidId?: string };
        const decision = ctx.priorOutputs["submission_approval"].decision as string;
        if (decision === "rejected") {
          return { kind: "completed", outputs: { submitted: false } };
        }
        const [bid] = await ctx.db
          .update(bids)
          .set({ submittedAt: new Date(), status: "submitted", updatedAt: new Date() })
          .where(eq(bids.id, p.bidId!))
          .returning();
        await logActivity(ctx.db, {
          entityType: "bid",
          entityId: bid.id,
          action: "bid.submitted",
          detail: `Submitted (recorded by QA gate)`,
          actor: "user",
          ploybookRunId: ctx.runId,
        });
        await emitEvent(ctx.db, {
          eventType: "bid.submitted", // PB13 Bid Follow-Up subscribes to this
          bidId: bid.id,
          opportunityId: bid.opportunityId ?? undefined,
          ploybookRunId: ctx.runId,
          payload: { submittedAt: bid.submittedAt?.toISOString() },
        });
        return { kind: "completed", outputs: { submitted: true, submittedAt: bid.submittedAt?.toISOString() } };
      },
    },
  ],
};
