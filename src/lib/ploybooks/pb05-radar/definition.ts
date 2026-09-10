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
  opportunity_type: z.string().max(60), // short label, not a sentence
  estimated_construction_value_usd: z.number().nullable(), // only when the signal states it
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
            "else goes in unknowns. TENANT RULE (from the owner): when a filing or project name " +
            "names the TENANT moving in (e.g. 'Chipotle finish-out', 'Interior build-out for " +
            "Acme Dental'), the tenant is the one who buys signs — extract the tenant as " +
            "company_name (company_type 'other' unless clearly a franchise/operator) and score " +
            "at the TOP of the band; a named tenant beats a named owner or GC as a signal. " +
            "opportunity_type is a SHORT label (2-4 words, e.g. 'new " +
            "construction', 'commercial remodel') — never a sentence. " +
            "estimated_construction_value_usd only when the signal states a dollar figure. " +
            "trade_relevance is explicit_signage only when signage/awning " +
            "scope is stated. estimated_relevance_score is 0-100 (NOT 0-10). Calibrate against " +
            "these anchors and use the FULL range — never park everything at a safe middle " +
            "value; two different signals should almost never share a score: " +
            "92 = active Houston bid invite explicitly naming signage/awning scope. " +
            "85 = interior build-out/finish-out with the TENANT named — a business moving in " +
            "needs signs on a known timeline. " +
            "80 = ground-up retail/restaurant/hotel in the Houston metro, $1M+ — signage " +
            "near-certain even if unstated. " +
            "68 = commercial remodel/build-out in the metro, signage plausible but unstated, " +
            "owner/GC unknown. " +
            "55 = office/industrial TI or facility remodel where signage is a maybe. " +
            "35 = infrastructure/civil work (roads, utilities) — signage unlikely. " +
            "15 = residential or clearly sign-free scope. " +
            "Adjust within a band: up for stated dollar value, a named GC/owner, near-term " +
            "dates; down for outside the metro or vague scope. " +
            "suggested_ploybook: pb01_gc_pursuit for GC/bid signals; none if irrelevant.",
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
        if (parsed.trade_relevance === "irrelevant") {
          return { kind: "skipped", reason: "Signal not relevant to HSC" };
        }
        if (!parsed.company_name && !parsed.project_name) {
          return { kind: "skipped", reason: "No company or project identified in signal" };
        }
        // Permit-style signals (e.g. TDLR) often name a facility/project but no company.
        // Anchor on the project and leave the account null — identifying the owner/GC is
        // the recommended next action, never a fabricated account (§5.4).
        const account = parsed.company_name
          ? (
              await createAccount(ctx.db, {
                name: parsed.company_name,
                accountType: parsed.company_type === "unknown" ? "prospect" : parsed.company_type,
                ploybookRunId: ctx.runId,
              })
            ).account
          : null;
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
        const oppName = account
          ? `${account.name}${project ? ` — ${project.name}` : ""}`
          : `${project!.name} (owner unknown)`;
        const { opportunity, created } = await createOpportunity(ctx.db, {
          name: oppName,
          accountId: account?.id,
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
          outputs: {
            opportunityId: opportunity.id,
            accountId: account?.id ?? null,
            projectId: project?.id ?? null,
            deduped: false,
          },
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
        // A stated construction value belongs to the PROJECT — never presented as
        // the signage opportunity's value.
        if (parsed.estimated_construction_value_usd != null && resolved.projectId) {
          const { projects } = await import("@/lib/db/schema");
          await ctx.db
            .update(projects)
            .set({
              estimatedProjectValue: String(parsed.estimated_construction_value_usd),
              updatedAt: new Date(),
            })
            .where(eq(projects.id, resolved.projectId as string));
        }
        await ctx.db
          .update(opportunities)
          .set({
            overallScore: Math.round(parsed.estimated_relevance_score),
            nextAction: !resolved.accountId
              ? "Identify owner/GC first (research)"
              : parsed.suggested_ploybook === "none"
                ? "review"
                : `Launch ${parsed.suggested_ploybook}`,
            updatedAt: new Date(),
          })
          .where(eq(opportunities.id, opportunityId));
        await saveEvidence(ctx.db, {
          entityType: "opportunity",
          entityId: opportunityId,
          fieldName: "why_this_matters",
          value: parsed.why_this_matters,
          sourceName: "pb05_radar",
          verificationStatus: "inferred",
        });
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
