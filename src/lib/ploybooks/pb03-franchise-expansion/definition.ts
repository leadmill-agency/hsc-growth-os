import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import {
  createAccount,
  createProject,
  createOpportunity,
  createRelationship,
  saveEvidence,
} from "@/lib/actions/entities";
import { scoreStrategic, locationCountValue } from "@/lib/scoring/strategic";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB03 — Franchise Expansion: brand expansion signal → multi-location signage program pursuit.
// Trigger payload: { brandName, website?, context? }

const evidenceStatus = z.enum(["verified", "inferred", "assumed", "unknown"]);

export const brandProfileSchema = z.object({
  brand_summary: z.string(),
  franchisor: z.string().nullable(),
  texas_location_count: z.number().nullable(),
  houston_location_count: z.number().nullable(),
  announced_openings: z.array(
    z.object({
      location_name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      stage: z.string().nullable(),
      status: evidenceStatus,
      note: z.string().nullable(),
    })
  ),
  franchisee_groups: z.array(
    z.object({ name: z.string(), territory: z.string().nullable(), status: evidenceStatus })
  ),
  buying_path: z.enum(["franchisor", "franchisee", "gc", "developer", "mixed", "unknown"]),
  sign_standards_note: z.string().nullable(),
  expansion_velocity: z.enum(["low", "medium", "high", "unknown"]),
  repeatability_note: z.string().nullable(),
  unknowns: z.array(z.string()),
});

export type BrandProfile = z.infer<typeof brandProfileSchema>;

export const pb03FranchiseExpansion: PloybookDefinition = {
  key: "pb03_franchise_expansion",
  name: "PB03 — Franchise Expansion",
  description:
    "Turns a brand-expansion signal into a multi-location program pursuit: brand research → footprint + announced openings → strategic score → child location opportunities → rollout recommendation.",
  version: "1.0",
  triggerTypes: ["manual", "event:opportunity.pursued"],
  steps: [
    {
      key: "create_brand_account",
      name: "Create franchise brand account",
      async run(ctx) {
        const p = ctx.triggerPayload as { brandName?: string; website?: string };
        if (!p.brandName) throw new Error("brandName is required");
        const { account } = await createAccount(ctx.db, {
          name: p.brandName,
          accountType: "franchise",
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { accountId: account.id, brandName: account.name } };
      },
    },
    {
      key: "research_footprint",
      name: "Research footprint and expansion",
      async run(ctx) {
        const p = ctx.triggerPayload as { context?: string };
        const prior = ctx.priorOutputs["create_brand_account"];
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Research the franchise/brand "${prior.brandName}": current Texas footprint (how many ` +
            `locations, how many in Greater Houston), announced or planned new Texas locations ` +
            `with cities, franchisee/operator groups active in Texas, whether store buildouts and ` +
            `signage are bought by the franchisor, franchisees, GCs, or developers, any public ` +
            `brand sign standards or approved-supplier program, and expansion pace.` +
            (p.context ? ` Context: ${p.context}` : ""),
          focus: "signage vendor evaluating a multi-location rollout program",
        });
        const llm = getLLMClient();
        const profile = await llm.generateStructured({
          system:
            "Extract a franchise expansion profile for a Houston sign company. Use ONLY the " +
            "research text. Counts must come from the research; use null when not established. " +
            "Mark each opening/group with evidence status. Everything unestablished goes in " +
            "unknowns. Never invent locations, counts, or people.",
          prompt:
            `RESEARCH:\n${research.text}\n\nSOURCES:\n${research.sources.map((s) => s.url).join("\n")}\n\n` +
            `Produce the expansion profile for ${prior.brandName}.`,
          schema: brandProfileSchema,
          effort: "medium",
        });
        await saveEvidence(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          fieldName: "texas_location_count",
          value: profile.texas_location_count,
          sourceUrl: research.sources[0]?.url,
          sourceName: "pb03_research",
          verificationStatus: profile.texas_location_count == null ? "unknown" : "inferred",
        });
        return { kind: "completed", outputs: { profile, sources: research.sources } };
      },
    },
    {
      key: "score_strategic",
      name: "Score strategic value",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_brand_account"];
        const profile = ctx.priorOutputs["research_footprint"].profile as BrandProfile;
        const txCount = profile.texas_location_count ?? profile.announced_openings.length;
        const houstonShare =
          profile.houston_location_count && txCount
            ? Math.min(1, profile.houston_location_count / Math.max(txCount, 1) + 0.3)
            : 0.5;
        const velocity =
          profile.expansion_velocity === "high" ? 1 : profile.expansion_velocity === "medium" ? 0.6 : 0.3;
        const result = scoreStrategic({
          revenuePotential: Math.min(1, txCount / 25),
          locationCount: locationCountValue(txCount),
          futureVolume: velocity,
          repeatability: profile.repeatability_note ? 0.8 : 0.6,
          localConcentration: houstonShare,
          multiTradeFit: 0.7,
          relationshipLeverage: 0,
          referenceValue: 0.6,
        });
        await ctx.db
          .update(accounts)
          .set({ strategicValueScore: result.score, updatedAt: new Date() })
          .where(eq(accounts.id, prior.accountId as string));
        await logActivity(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          action: "account.strategic_scored",
          detail: `Strategic ${result.score} (${result.band})`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { strategic: result } };
      },
    },
    {
      key: "create_location_opportunities",
      name: "Create location projects + child opportunities",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_brand_account"];
        const profile = ctx.priorOutputs["research_footprint"].profile as BrandProfile;
        const accountId = prior.accountId as string;
        const created: string[] = [];
        for (const opening of profile.announced_openings) {
          if (opening.status === "assumed" || opening.status === "unknown") continue; // no speculative records
          const { project } = await createProject(ctx.db, {
            name: `${prior.brandName} — ${opening.location_name}`,
            city: opening.city ?? undefined,
            state: opening.state ?? "TX",
            stage: opening.stage ?? "announced",
            ownerAccountId: accountId,
            source: "pb03",
            ploybookRunId: ctx.runId,
          });
          const { opportunity } = await createOpportunity(ctx.db, {
            name: `${prior.brandName} — ${opening.location_name} signage`,
            accountId,
            projectId: project.id,
            opportunityType: "franchise_location",
            tradeScope: "exterior + interior signage",
            stage: "discovered",
            source: "pb03",
            ploybookRunId: ctx.runId,
          });
          await createRelationship(ctx.db, {
            fromEntityType: "account",
            fromEntityId: accountId,
            relationshipType: "EXPANDING_AT",
            toEntityType: "project",
            toEntityId: project.id,
            source: "pb03",
          });
          created.push(opportunity.id);
        }
        return {
          kind: "completed",
          outputs: { childOpportunityIds: created, skipped: profile.announced_openings.length - created.length },
        };
      },
    },
    {
      key: "rollout_recommendation",
      name: "Rollout recommendation",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_brand_account"];
        const profile = ctx.priorOutputs["research_footprint"].profile as BrandProfile;
        const strategic = ctx.priorOutputs["score_strategic"].strategic as { score: number; band: string };
        const children = ctx.priorOutputs["create_location_opportunities"].childOpportunityIds as string[];
        const recommendation = {
          band: strategic.band,
          strategicScore: strategic.score,
          buyingPath: profile.buying_path,
          childOpportunities: children.length,
          motion:
            profile.buying_path === "franchisee"
              ? "Pursue Texas franchisee groups directly; offer per-site pre-work (survey, permit review, budget) before award."
              : profile.buying_path === "franchisor"
                ? "Pursue franchisor construction/procurement for approved-supplier status; standardize package pricing."
                : "Confirm buying path first (franchisor vs franchisee vs GC) — it changes who we contact.",
          unknownsToResolve: profile.unknowns,
        };
        await emitEvent(ctx.db, {
          eventType: "account.rollout_recommended",
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
          payload: recommendation,
        });
        await logActivity(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          action: "rollout.recommended",
          detail: `${recommendation.motion} (${children.length} child opportunities)`,
          ploybookRunId: ctx.runId,
        });
        // The readable brief the account page renders whole (2026-09-11).
        const { saveAccountResearchBrief, briefFromBrand } = await import(
          "@/lib/actions/research-brief"
        );
        const sources = (ctx.priorOutputs["research_footprint"].sources ?? []) as { url: string }[];
        await saveAccountResearchBrief(ctx.db, {
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
          brief: briefFromBrand(profile, recommendation.motion, sources.map((s) => s.url)),
        });
        return { kind: "completed", outputs: { recommendation } };
      },
    },
  ],
};
