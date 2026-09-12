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
            "packages), and so are TENANT BUILD-OUTS for named retail/restaurant/hospitality " +
            "brands (a Nordstrom Rack or Chipotle build-out carries a sign package even when " +
            "the invite doesn't say so). supplier_fab_items_expected: awning/canopy/backlit items HSC buys from " +
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
          entityType: "opportunity",
          entityId: opportunity.id,
          fieldName: "origin_signal",
          value: (p.inviteText ?? "").slice(0, 2000),
          sourceUrl: p.sourceUrl,
          sourceName: p.source ?? "bid_invite",
          verificationStatus: "verified",
        });
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
        {
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
          const { opportunities } = await import("@/lib/db/schema");
          const { eq, sql } = await import("drizzle-orm");
          // PASS by rule = closed by the system (per Rameel 2026-09-12: "if you
          // believe we should pass on a bid, I trust you to close out the
          // card"). Visible in History and the brief's passed-on count.
          if (recommendation === "PASS") {
            const reasonCode =
              parsed.service_area === "outside_texas" || parsed.service_area === "texas_outside_houston"
                ? "too_far"
                : "no_sign_scope";
            const reasonText = (areaNote.trim() || "No signage/awning scope identified in the invite.").trim();
            await ctx.db
              .update(opportunities)
              .set({ stage: "dismissed", nextAction: null, updatedAt: new Date() })
              .where(eq(opportunities.id, records.opportunityId as string));
            await ctx.db
              .update(bids)
              .set({ status: "passed", lossReason: reasonText, updatedAt: new Date() })
              .where(eq(bids.id, records.bidId as string));
            await logActivity(ctx.db, {
              entityType: "opportunity",
              entityId: records.opportunityId as string,
              action: "opportunity.dismissed",
              detail: `${records.accountName} — ${records.projectName} auto-passed: ${reasonText}`,
              actor: "system",
              ploybookRunId: ctx.runId,
              metadata: { reasonCode, note: reasonText, autoPassed: true },
            });
            return { kind: "completed", outputs: { recommendation, areaNote, autoPassed: true, childRunId: null } };
          }
          // BID/REVIEW invites are TRIAGE cards in the Opportunities inbox: the
          // recommendation rides the card; Pursue = we're bidding, Dismiss = pass.
          await ctx.db
            .update(opportunities)
            .set({
              nextAction: `${recommendation} recommended.${areaNote || ""}`,
              updatedAt: new Date(),
            })
            .where(eq(opportunities.id, records.opportunityId as string));
          await ctx.db
            .update(bids)
            .set({
              notes: sql`coalesce(${bids.notes} || ' — ', '') || ${`Radar recommendation: ${recommendation}.${areaNote || ""}`}`,
              updatedAt: new Date(),
            })
            .where(eq(bids.id, records.bidId as string));
          // A document folder attached at intake still analyzes immediately —
          // the estimator brief is triage input, not a post-acceptance step.
          let childRunId: string | null = null;
          const p = ctx.triggerPayload as { folderPath?: string };
          if (p.folderPath) {
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
          return { kind: "completed", outputs: { recommendation, areaNote, childRunId } };
        }
      },
    },
  ],
};
