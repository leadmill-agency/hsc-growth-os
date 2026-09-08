import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { createAccount, createProject, createOpportunity, saveEvidence } from "@/lib/actions/entities";
import { opportunities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB05 — Opportunity Radar (manual-signal MVP slice).
// Trigger payload: { signalText, sourceUrl?, source? } — a bid notice, permit line, news blurb,
// forwarded email, or PlanHub invitation pasted/forwarded in. Scheduled source pulls (TDLR, CoH,
// PlanHub) will feed this same pipeline in Phase 2+.

const signalParseSchema = z.object({
  company_name: z.string().nullable(),
  company_type: z
    .enum(["general_contractor", "developer", "franchise", "facility_operator", "property_owner", "other", "unknown"]),
  project_name: z.string().nullable(),
  city: z.string().nullable(),
  trade_relevance: z.enum(["explicit_signage", "likely_signage", "adjacent", "irrelevant"]),
  opportunity_type: z.string(),
  estimated_relevance_score: z.number().min(0).max(100),
  why_this_matters: z.string(),
  suggested_ploybook: z.enum(["pb01_gc_pursuit", "pb02", "pb03", "pb04", "none"]),
  unknowns: z.array(z.string()),
});

export const pb05OpportunityRadar: PloybookDefinition = {
  key: "pb05_opportunity_radar",
  name: "PB05 — Opportunity Radar",
  description:
    "Turns a raw signal (bid notice, permit, news, PlanHub invite) into a scored, deduplicated suggested opportunity with a 'why this matters' and a suggested next ploybook.",
  version: "1.0",
  triggerTypes: ["manual", "scheduled"],
  steps: [
    {
      key: "parse_signal",
      name: "Parse and classify signal",
      async run(ctx) {
        const p = ctx.triggerPayload as { signalText?: string; sourceUrl?: string };
        if (!p.signalText) throw new Error("signalText is required");
        const llm = getLLMClient();
        const parsed = await llm.generateStructured({
          system:
            "You classify raw commercial-construction signals for Houston Sign Crafters " +
            "(signs/awnings, Houston TX). Extract only what the signal actually says; everything " +
            "else goes in unknowns. trade_relevance is explicit_signage only when signage/awning " +
            "scope is stated. estimated_relevance_score is on a 0-100 scale (NOT 0-10): 85-100 " +
            "pursue now (Houston + explicit signage + active bid), 70-84 strong, 50-69 monitor, " +
            "<50 weak. suggested_ploybook: pb01_gc_pursuit for GC/bid signals; none if irrelevant.",
          prompt: `SIGNAL:\n${p.signalText}\n${p.sourceUrl ? `URL: ${p.sourceUrl}` : ""}`,
          schema: signalParseSchema,
          effort: "low",
        });
        return { kind: "completed", outputs: { parsed } };
      },
    },
    {
      key: "resolve_entities",
      name: "Create suggested opportunity",
      async run(ctx) {
        const p = ctx.triggerPayload as { signalText?: string; sourceUrl?: string; source?: string };
        const parsed = ctx.priorOutputs["parse_signal"].parsed as z.infer<typeof signalParseSchema>;
        if (parsed.trade_relevance === "irrelevant" || !parsed.company_name) {
          return { kind: "skipped", reason: "Signal not relevant to HSC or no company identified" };
        }
        const { account } = await createAccount(ctx.db, {
          name: parsed.company_name,
          accountType: parsed.company_type === "unknown" ? "prospect" : parsed.company_type,
          ploybookRunId: ctx.runId,
        });
        const { project } = parsed.project_name
          ? await createProject(ctx.db, {
              name: parsed.project_name,
              city: parsed.city ?? undefined,
              state: "TX",
              source: p.source ?? "radar",
              sourceUrl: p.sourceUrl,
              ploybookRunId: ctx.runId,
            })
          : { project: null };
        const { opportunity, created } = await createOpportunity(ctx.db, {
          name: `${account.name}${project ? ` — ${project.name}` : ""}`,
          accountId: account.id,
          projectId: project?.id,
          opportunityType: parsed.opportunity_type,
          stage: "discovered",
          source: p.source ?? "radar",
          sourceDetail: p.sourceUrl,
          ploybookRunId: ctx.runId,
        });
        if (!created) {
          return {
            kind: "completed",
            outputs: { opportunityId: opportunity.id, deduped: true },
          };
        }
        await saveEvidence(ctx.db, {
          entityType: "opportunity",
          entityId: opportunity.id,
          fieldName: "origin_signal",
          value: (p.signalText ?? "").slice(0, 2000),
          sourceUrl: p.sourceUrl,
          sourceName: p.source ?? "manual_signal",
          verificationStatus: "verified",
        });
        return {
          kind: "completed",
          outputs: { opportunityId: opportunity.id, accountId: account.id, deduped: false },
        };
      },
    },
    {
      key: "score_and_recommend",
      name: "Score and recommend",
      async run(ctx) {
        const resolved = ctx.priorOutputs["resolve_entities"];
        if (!resolved?.opportunityId) {
          return { kind: "skipped", reason: "No opportunity created" };
        }
        const parsed = ctx.priorOutputs["parse_signal"].parsed as z.infer<typeof signalParseSchema>;
        const opportunityId = resolved.opportunityId as string;
        await ctx.db
          .update(opportunities)
          .set({
            overallScore: Math.round(parsed.estimated_relevance_score),
            nextAction:
              parsed.suggested_ploybook === "none"
                ? "review"
                : `Launch ${parsed.suggested_ploybook}`,
            updatedAt: new Date(),
          })
          .where(eq(opportunities.id, opportunityId));
        await logActivity(ctx.db, {
          entityType: "opportunity",
          entityId: opportunityId,
          action: "opportunity.discovered",
          detail: `${parsed.estimated_relevance_score} — ${parsed.why_this_matters}`,
          ploybookRunId: ctx.runId,
        });
        await emitEvent(ctx.db, {
          eventType: "opportunity.discovered",
          opportunityId,
          ploybookRunId: ctx.runId,
          payload: {
            score: parsed.estimated_relevance_score,
            whyThisMatters: parsed.why_this_matters,
            suggestedPloybook: parsed.suggested_ploybook,
          },
        });
        return {
          kind: "completed",
          outputs: {
            score: parsed.estimated_relevance_score,
            whyThisMatters: parsed.why_this_matters,
            suggestedPloybook: parsed.suggested_ploybook,
          },
        };
      },
    },
  ],
};
