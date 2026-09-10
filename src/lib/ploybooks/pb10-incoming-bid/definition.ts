import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { createAccount, createProject, createOpportunity, saveEvidence } from "@/lib/actions/entities";
import { bids } from "@/lib/db/schema";
import { launchRun } from "../runner";
import { emitEvent, logActivity } from "@/lib/events";

// PB10 — Incoming Bid: invitation (PlanHub download or email) → qualified, tracked bid.
// Trigger payload: { inviteText, folderPath?, sourceUrl?, source? }
// Jamal's real intake: PlanHub invites + GC emails like C.A. Walker's RTG invite.

const inviteParseSchema = z.object({
  gc_name: z.string().nullable(),
  project_name: z.string().nullable(),
  project_address: z.string().nullable(),
  city: z.string().nullable(),
  scope_summary: z.string(),
  bid_due: z.string().nullable(), // ISO date-time when stated
  submission_method: z.string().nullable(), // email address or portal
  signage_awning_relevance: z.enum(["explicit", "likely", "unclear", "none"]),
  supplier_fab_items_expected: z.array(z.string()), // awnings/canopies/backlit → supplier RFQs
  // Service-area rule (per Rameel 2026-09-10): canopies/awnings sell statewide,
  // signage sticks to the Houston metro (~150 mi of downtown).
  service_area: z.enum(["houston_metro", "texas_outside_houston", "outside_texas", "unknown"]),
  unknowns: z.array(z.string()),
});

export const pb10IncomingBid: PloybookDefinition = {
  key: "pb10_incoming_bid",
  name: "PB10 — Incoming Bid",
  description:
    "Parses a bid invitation (PlanHub/email) into project + GC + tracked bid with due dates, recommends BID/REVIEW/PASS, and on acceptance queues the PB11 package analysis.",
  version: "1.0",
  triggerTypes: ["manual", "event:bid.invite_received"],
  steps: [
    {
      key: "parse_invite",
      name: "Parse invitation",
      async run(ctx) {
        const p = ctx.triggerPayload as { inviteText?: string };
        if (!p.inviteText) throw new Error("inviteText is required");
        const llm = getLLMClient();
        const parsed = await llm.generateStructured({
          system:
            "Parse a construction bid invitation for Houston Sign Crafters (signs, awnings, " +
            "canopies). Extract only what the invitation states; unknowns stay unknown. " +
            "signage_awning_relevance: 'explicit' only if sign/awning/canopy scope is named; " +
            "ground-up commercial buildings are 'likely' (they almost always carry signage/canopy " +
            "packages). supplier_fab_items_expected: awning/canopy/backlit items HSC buys from " +
            "suppliers. service_area from the project location: houston_metro = within ~150 " +
            "miles of downtown Houston (includes Galveston, Beaumont, College Station, " +
            "Victoria); texas_outside_houston = Texas beyond that (Dallas, Austin, San Antonio, " +
            "Waco, Laredo, McAllen, Corpus Christi...). bid_due as ISO 8601 when a date is stated.",
          prompt: `INVITATION:\n${p.inviteText}`,
          schema: inviteParseSchema,
          effort: "low",
        });
        return { kind: "completed", outputs: { parsed } };
      },
    },
    {
      key: "create_bid_records",
      name: "Create project, opportunity, bid",
      async run(ctx) {
        const p = ctx.triggerPayload as { sourceUrl?: string; source?: string; inviteText?: string };
        const parsed = ctx.priorOutputs["parse_invite"].parsed as z.infer<typeof inviteParseSchema>;
        if (parsed.signage_awning_relevance === "none") {
          return { kind: "skipped", reason: "Invitation has no signage/awning relevance" };
        }
        const { account } = await createAccount(ctx.db, {
          name: parsed.gc_name ?? "Unknown GC",
          accountType: "general_contractor",
          ploybookRunId: ctx.runId,
        });
        const { project } = await createProject(ctx.db, {
          name: parsed.project_name ?? "Unnamed project",
          address: parsed.project_address ?? undefined,
          city: parsed.city ?? undefined,
          state: "TX",
          stage: "bidding",
          gcAccountId: account.id,
          source: p.source ?? "bid_invite",
          sourceUrl: p.sourceUrl,
          ploybookRunId: ctx.runId,
        });
        const { opportunity } = await createOpportunity(ctx.db, {
          name: `${account.name} — ${project.name} (bid)`,
          accountId: account.id,
          projectId: project.id,
          opportunityType: "incoming_bid",
          tradeScope: parsed.supplier_fab_items_expected.length
            ? `signage + ${parsed.supplier_fab_items_expected.join(", ")}`
            : "signage",
          stage: "bid_invited",
          source: p.source ?? "bid_invite",
          ploybookRunId: ctx.runId,
        });
        const dueAt = parsed.bid_due ? new Date(parsed.bid_due) : null;
        const internalDueAt = dueAt ? new Date(dueAt.getTime() - 2 * 24 * 3600 * 1000) : null;
        const [bid] = await ctx.db
          .insert(bids)
          .values({
            opportunityId: opportunity.id,
            dueAt: dueAt ?? undefined,
            internalDueAt: internalDueAt ?? undefined,
            status: "invited",
            notes: `Submit via: ${parsed.submission_method ?? "unknown"}. Assigned: Jamal.`,
          })
          .returning();
        await saveEvidence(ctx.db, {
          entityType: "bid",
          entityId: bid.id,
          fieldName: "invitation",
          value: (p.inviteText ?? "").slice(0, 3000),
          sourceUrl: p.sourceUrl,
          sourceName: p.source ?? "bid_invite",
          verificationStatus: "verified",
        });
        await emitEvent(ctx.db, {
          eventType: "bid.invite_received",
          accountId: account.id,
          projectId: project.id,
          opportunityId: opportunity.id,
          bidId: bid.id,
          ploybookRunId: ctx.runId,
          payload: { dueAt: parsed.bid_due },
        });
        return {
          kind: "completed",
          outputs: {
            accountId: account.id,
            accountName: account.name,
            projectId: project.id,
            projectName: project.name,
            opportunityId: opportunity.id,
            bidId: bid.id,
          },
        };
      },
    },
    {
      key: "recommend",
      name: "Recommend BID / REVIEW / PASS",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const parsed = ctx.priorOutputs["parse_invite"].parsed as z.infer<typeof inviteParseSchema>;
          const records = ctx.priorOutputs["create_bid_records"];
          // Service-area rule: canopy/awning work is worth chasing anywhere in
          // Texas; signage-only work sticks to the Houston metro.
          const hasCanopyAwning = parsed.supplier_fab_items_expected.length > 0;
          const byRelevance =
            parsed.signage_awning_relevance === "explicit"
              ? "BID"
              : parsed.signage_awning_relevance === "likely"
                ? "REVIEW"
                : "PASS";
          let recommendation = byRelevance;
          let areaNote = "";
          if (parsed.service_area === "outside_texas") {
            recommendation = "PASS";
            areaNote = " Outside Texas — beyond HSC's service area.";
          } else if (parsed.service_area === "texas_outside_houston") {
            if (hasCanopyAwning) {
              areaNote = " Outside the Houston metro but canopy/awning scope — HSC serves those statewide.";
            } else {
              recommendation = "PASS";
              areaNote = " Signage-only outside the Houston metro — HSC keeps sign work local.";
            }
          }
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "accept_bid",
              title: `${recommendation}: ${records.accountName} — ${records.projectName}`,
              summary:
                `${parsed.scope_summary} Due: ${parsed.bid_due ?? "unknown"}. ` +
                `Supplier-fab items expected: ${parsed.supplier_fab_items_expected.join(", ") || "none identified"}.` +
                areaNote,
              proposedAction:
                "Approve to accept the bid (assigns Jamal, queues PB11 package analysis). Reject to pass.",
              payload: { recommendation, parsed, bidId: records.bidId },
            },
          };
        }
        const res = (ctx.approvalResolution.payload ?? {}) as {
          rejectionCode?: string;
          rejectionNote?: string;
        };
        return {
          kind: "completed",
          outputs: {
            decision: ctx.approvalResolution.status,
            rejectionCode: res.rejectionCode ?? null,
            rejectionNote: res.rejectionNote ?? null,
          },
        };
      },
    },
    {
      key: "activate_bid",
      name: "Activate bid + queue analysis",
      async run(ctx) {
        const p = ctx.triggerPayload as { folderPath?: string };
        const decision = ctx.priorOutputs["recommend"].decision as string;
        const records = ctx.priorOutputs["create_bid_records"];
        const { eq } = await import("drizzle-orm");
        if (decision === "rejected") {
          const code = ctx.priorOutputs["recommend"].rejectionCode as string | null;
          const note = ctx.priorOutputs["recommend"].rejectionNote as string | null;
          const reason = [code?.replaceAll("_", " "), note].filter(Boolean).join(" — ");
          const { sql } = await import("drizzle-orm");
          await ctx.db
            .update(bids)
            .set({
              status: "passed",
              lossReason: reason || null,
              ...(reason
                ? { notes: sql`coalesce(${bids.notes} || ' — ', '') || ${"Passed: " + reason}` }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(bids.id, records.bidId as string));
          return { kind: "completed", outputs: { status: "passed", childRunId: null, reason } };
        }
        await ctx.db
          .update(bids)
          .set({ status: "estimating", updatedAt: new Date() })
          .where(eq(bids.id, records.bidId as string));
        let childRunId: string | null = null;
        if (p.folderPath) {
          const parsed = ctx.priorOutputs["parse_invite"].parsed as { bid_due: string | null };
          childRunId = await launchRun(ctx.db, {
            ploybookKey: "pb11_bid_analyzer",
            triggerType: "ploybook",
            triggerPayload: {
              folderPath: p.folderPath,
              bidId: records.bidId,
              projectId: records.projectId,
              opportunityId: records.opportunityId,
              projectName: records.projectName,
              bidDueAt: parsed.bid_due ?? undefined,
            },
            parentRunId: ctx.runId,
            initiatedBy: "system",
          });
        }
        await logActivity(ctx.db, {
          entityType: "bid",
          entityId: records.bidId as string,
          action: "bid.accepted",
          detail: `Assigned Jamal${childRunId ? "; PB11 analysis queued" : "; no document folder provided"}`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { status: "estimating", childRunId } };
      },
    },
  ],
};
