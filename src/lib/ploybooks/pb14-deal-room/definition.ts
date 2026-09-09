import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { opportunities, accounts, evidence } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  dealRoomContentSchema,
  createProposalDraft,
  publishProposal,
} from "@/lib/actions/proposals";
import { saveEvidence } from "@/lib/actions/entities";
import { logActivity } from "@/lib/events";

// PB14 — Proposal Deal Room: trackable private proposal page instead of a static PDF.
// Trigger payload: { opportunityId }
// Content grounds ONLY on stored research/brief evidence; pricing stays human-entered
// (the page shows "pricing pending" until a human sets amounts on the proposal row).

export const pb14DealRoom: PloybookDefinition = {
  key: "pb14_deal_room",
  name: "PB14 — Proposal Deal Room",
  description:
    "Builds a private, trackable deal-room page for an opportunity (scope, timeline, warranty, exclusions, FAQs; pricing entered by a human), publish-gated, with per-view tracking and a 3-views-in-24h follow-up trigger.",
  version: "1.0",
  triggerTypes: ["manual", "event:quote_ready"],
  steps: [
    {
      key: "load_context",
      name: "Load opportunity context",
      async run(ctx) {
        const p = ctx.triggerPayload as { opportunityId?: string };
        if (!p.opportunityId) throw new Error("opportunityId is required");
        const opportunity = await ctx.db.query.opportunities.findFirst({
          where: eq(opportunities.id, p.opportunityId),
        });
        if (!opportunity) throw new Error(`Opportunity not found: ${p.opportunityId}`);
        const account = opportunity.accountId
          ? await ctx.db.query.accounts.findFirst({ where: eq(accounts.id, opportunity.accountId) })
          : null;
        const briefRows = await ctx.db.query.evidence.findMany({
          where: and(eq(evidence.entityType, "bid"), eq(evidence.fieldName, "estimator_brief")),
          orderBy: desc(evidence.retrievedAt),
          limit: 1,
        });
        return {
          kind: "completed",
          outputs: {
            opportunityId: opportunity.id,
            opportunityName: opportunity.name,
            tradeScope: opportunity.tradeScope,
            accountName: account?.name ?? null,
            accountNotes: account?.notes ?? null,
            estimatorBrief: briefRows[0]?.value ?? null,
          },
        };
      },
    },
    {
      key: "compose_deal_room",
      name: "Compose deal-room content",
      async run(ctx) {
        const prior = ctx.priorOutputs["load_context"];
        const llm = getLLMClient();
        const content = await llm.generateStructured({
          system:
            "Compose deal-room proposal content for Houston Sign Crafters (UL-certified, built " +
            "in Houston, 5-year warranty, in-house survey/permit/fabricate/install for signs; " +
            "awnings/canopies/backlit via qualified suppliers). Use ONLY the context provided — " +
            "no invented scope, no numbers, NO PRICING of any kind (a human enters pricing). " +
            "Timeline: describe the process stages, never promise dates. Warranty: the real " +
            "5-year warranty. Exclusions: standard HSC exclusions relevant to this scope. " +
            "Plain English, short sentences, one clear next step.",
          prompt:
            `Opportunity: ${prior.opportunityName}\nCustomer: ${prior.accountName ?? "unknown"}\n` +
            `Trade scope: ${prior.tradeScope ?? "signage"}\n` +
            `Account context: ${prior.accountNotes ?? "none"}\n` +
            `Estimator brief (if any): ${JSON.stringify(prior.estimatorBrief ?? "none").slice(0, 6000)}\n\n` +
            `Compose the deal room.`,
          schema: dealRoomContentSchema,
          effort: "medium",
        });
        const { proposal } = await createProposalDraft(ctx.db, {
          opportunityId: prior.opportunityId as string,
          name: prior.opportunityName as string,
          content,
          ploybookRunId: ctx.runId,
        });
        await saveEvidence(ctx.db, {
          entityType: "proposal",
          entityId: proposal.id,
          fieldName: "deal_room_content",
          value: content,
          sourceName: "pb14",
          verificationStatus: "inferred",
        });
        return {
          kind: "completed",
          outputs: { proposalId: proposal.id, publicToken: proposal.publicToken, content },
        };
      },
    },
    {
      key: "publish_approval",
      name: "Request approval to publish",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const prior = ctx.priorOutputs["load_context"];
          const composed = ctx.priorOutputs["compose_deal_room"];
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "publish_proposal",
              title: `Publish deal room: ${prior.opportunityName}`,
              summary:
                "Private trackable proposal page. Pricing shows as pending until entered on the proposal record.",
              proposedAction: `Publish at /d/${composed.publicToken}`,
              payload: { proposalId: composed.proposalId, content: composed.content },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "publish",
      name: "Publish (or hold)",
      async run(ctx) {
        const decision = ctx.priorOutputs["publish_approval"].decision as string;
        const composed = ctx.priorOutputs["compose_deal_room"];
        const prior = ctx.priorOutputs["load_context"];
        if (decision === "rejected") {
          return { kind: "completed", outputs: { published: false, url: null } };
        }
        await publishProposal(ctx.db, composed.proposalId as string);
        await logActivity(ctx.db, {
          entityType: "opportunity",
          entityId: prior.opportunityId as string,
          action: "proposal.published",
          detail: `/d/${composed.publicToken}`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { published: true, url: `/d/${composed.publicToken}` } };
      },
    },
  ],
};
