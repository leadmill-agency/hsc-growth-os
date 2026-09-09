import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { opportunities, accounts, evidence } from "@/lib/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { saveEvidence } from "@/lib/actions/entities";
import { logActivity } from "@/lib/events";

// PB15 — Business Case / Deal Progression: help a champion sell a large HSC
// engagement internally. Hard rule (PB15 PRD): confirmed facts and assumptions
// are NEVER mixed — every figure is labeled, and financials are ranges marked
// as assumptions unless a human confirmed them in writing.
// Trigger payload: { opportunityId, context? }

const businessCaseSchema = z.object({
  title: z.string(),
  current_state: z.string(),
  proposed_model: z.string(),
  confirmed_facts: z.array(z.object({ fact: z.string(), source: z.string() })),
  assumptions: z.array(z.object({ assumption: z.string(), basis: z.string() })),
  financial_ranges: z.array(
    z.object({ item: z.string(), low: z.string(), high: z.string(), label: z.literal("ASSUMPTION") })
  ),
  operational_benefits: z.array(z.string()),
  risk_reduction: z.array(z.string()),
  implementation_plan: z.array(z.object({ phase: z.string(), detail: z.string() })),
  next_decision: z.string(),
  open_questions_for_champion: z.array(z.string()),
});

export const pb15BusinessCase: PloybookDefinition = {
  key: "pb15_business_case",
  name: "PB15 — Business Case / Deal Progression",
  description:
    "Drafts the internal business case a champion needs to sell a large HSC engagement — current state, proposed model, confirmed facts strictly separated from assumptions, financial ranges labeled ASSUMPTION, implementation plan, next decision.",
  version: "1.0",
  triggerTypes: ["manual"],
  steps: [
    {
      key: "load_context",
      name: "Load opportunity + evidence",
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
        const accountEvidence = opportunity.accountId
          ? await ctx.db.query.evidence.findMany({
              where: and(eq(evidence.entityType, "account"), eq(evidence.entityId, opportunity.accountId)),
              orderBy: desc(evidence.retrievedAt),
              limit: 10,
            })
          : [];
        return {
          kind: "completed",
          outputs: {
            opportunityId: opportunity.id,
            opportunityName: opportunity.name,
            accountName: account?.name ?? null,
            accountNotes: account?.notes ?? null,
            strategicScore: account?.strategicValueScore ?? null,
            evidenceRows: accountEvidence.map((e) => ({
              field: e.fieldName,
              value: e.value,
              status: e.verificationStatus,
            })),
          },
        };
      },
    },
    {
      key: "draft_business_case",
      name: "Draft business case",
      async run(ctx) {
        const p = ctx.triggerPayload as { context?: string };
        const prior = ctx.priorOutputs["load_context"];
        const llm = getLLMClient();
        const businessCase = await llm.generateStructured({
          system:
            "Draft an internal business case a champion at the customer can circulate to " +
            "justify choosing Houston Sign Crafters for a multi-location/large signage " +
            "engagement. STRICT RULES: confirmed_facts may only contain items explicitly " +
            "present in the provided context, each with its source named; everything else is " +
            "an assumption with its basis stated. Financial figures are ranges labeled " +
            "ASSUMPTION — never present an estimate as a fact. If the context is thin, say so " +
            "via open_questions_for_champion rather than padding. Plain English, no hype.",
          prompt:
            `Opportunity: ${prior.opportunityName}\nCustomer: ${prior.accountName ?? "unknown"}\n` +
            `Account notes: ${prior.accountNotes ?? "none"}\n` +
            `Evidence rows: ${JSON.stringify(prior.evidenceRows).slice(0, 6000)}\n` +
            `Extra context from HSC: ${p.context ?? "none"}\n\nDraft the business case.`,
          schema: businessCaseSchema,
          effort: "medium",
        });
        await saveEvidence(ctx.db, {
          entityType: "opportunity",
          entityId: prior.opportunityId as string,
          fieldName: "business_case",
          value: businessCase,
          sourceName: "pb15",
          verificationStatus: "inferred",
        });
        await logActivity(ctx.db, {
          entityType: "opportunity",
          entityId: prior.opportunityId as string,
          action: "business_case.drafted",
          detail: businessCase.title,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { businessCase } };
      },
    },
  ],
};
