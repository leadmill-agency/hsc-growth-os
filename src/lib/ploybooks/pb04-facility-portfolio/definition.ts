import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import {
  createAccount,
  createProperty,
  createOpportunity,
  createRelationship,
  saveEvidence,
} from "@/lib/actions/entities";
import { scoreStrategic, locationCountValue } from "@/lib/scoring/strategic";
import { accounts, contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB04 — Facility Portfolio Pursuit: multi-location operator → recurring portfolio account.
// Trigger payload: { operatorName, website?, context? }

const evidenceStatus = z.enum(["verified", "inferred", "assumed", "unknown"]);

export const portfolioProfileSchema = z.object({
  operator_summary: z.string(),
  category: z.string(),
  houston_location_count: z.number().nullable(),
  texas_location_count: z.number().nullable(),
  known_locations: z.array(
    z.object({
      name: z.string(),
      address: z.string().nullable(),
      city: z.string().nullable(),
      status: evidenceStatus,
    })
  ),
  facility_contacts: z.array(
    z.object({
      name: z.string(),
      title: z.string().nullable(),
      role_type: z.string(),
      status: evidenceStatus,
    })
  ),
  activity_signals: z.array(z.string()),
  incumbent_vendor_note: z.string().nullable(),
  service_potential: z.enum(["high", "medium", "low", "unknown"]),
  unknowns: z.array(z.string()),
});

export type PortfolioProfile = z.infer<typeof portfolioProfileSchema>;

export const pb04FacilityPortfolio: PloybookDefinition = {
  key: "pb04_facility_portfolio",
  name: "PB04 — Facility Portfolio Pursuit",
  description:
    "Turns a multi-location operator into a portfolio pursuit: research the location portfolio and facilities contacts → normalize properties → strategic score → location opportunities → centralized-program recommendation.",
  version: "1.0",
  triggerTypes: ["manual", "event:opportunity.pursued"],
  steps: [
    {
      key: "create_operator_account",
      name: "Create operator account",
      async run(ctx) {
        const p = ctx.triggerPayload as { operatorName?: string; website?: string };
        if (!p.operatorName) throw new Error("operatorName is required");
        const { account } = await createAccount(ctx.db, {
          name: p.operatorName,
          accountType: "facility_operator",
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { accountId: account.id, operatorName: account.name } };
      },
    },
    {
      key: "research_portfolio",
      name: "Research location portfolio",
      async run(ctx) {
        const p = ctx.triggerPayload as { context?: string };
        const prior = ctx.priorOutputs["create_operator_account"];
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Research the multi-location operator "${prior.operatorName}": how many locations in ` +
            `Greater Houston and Texas (with addresses where public), facilities/construction/` +
            `real-estate/procurement leadership, recent openings, remodels, rebrands or ` +
            `acquisitions, and any known signage vendors they use.` +
            (p.context ? ` Context: ${p.context}` : ""),
          focus: "signage vendor evaluating a portfolio service + rollout account",
        });
        const llm = getLLMClient();
        const profile = await llm.generateStructured({
          system:
            "Extract a facility-portfolio profile for a Houston sign company. Use ONLY the " +
            "research text; null for counts the research does not establish; evidence status on " +
            "every location and contact; unestablished items go in unknowns. Never invent " +
            "locations, people, or vendors.",
          prompt:
            `RESEARCH:\n${research.text}\n\nSOURCES:\n${research.sources.map((s) => s.url).join("\n")}\n\n` +
            `Produce the portfolio profile for ${prior.operatorName}.`,
          schema: portfolioProfileSchema,
          effort: "medium",
        });
        await saveEvidence(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          fieldName: "houston_location_count",
          value: profile.houston_location_count,
          sourceUrl: research.sources[0]?.url,
          sourceName: "pb04_research",
          verificationStatus: profile.houston_location_count == null ? "unknown" : "inferred",
        });
        return { kind: "completed", outputs: { profile, sources: research.sources } };
      },
    },
    {
      key: "normalize_locations",
      name: "Normalize properties + contacts",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_operator_account"];
        const profile = ctx.priorOutputs["research_portfolio"].profile as PortfolioProfile;
        const accountId = prior.accountId as string;
        const propertyIds: string[] = [];
        for (const loc of profile.known_locations) {
          if (loc.status === "assumed" || loc.status === "unknown") continue;
          const { property } = await createProperty(ctx.db, {
            name: `${prior.operatorName} — ${loc.name}`,
            address: loc.address ?? undefined,
            city: loc.city ?? undefined,
            ownerAccountId: accountId,
            type: profile.category,
          });
          await createRelationship(ctx.db, {
            fromEntityType: "account",
            fromEntityId: accountId,
            relationshipType: "OPERATES",
            toEntityType: "property",
            toEntityId: property.id,
            source: "pb04",
          });
          propertyIds.push(property.id);
        }
        for (const person of profile.facility_contacts) {
          const [first, ...rest] = person.name.split(" ");
          await ctx.db.insert(contacts).values({
            accountId,
            firstName: first,
            lastName: rest.join(" ") || null,
            title: person.title,
            roleType: person.role_type,
            source: "pb04_research",
          });
        }
        return {
          kind: "completed",
          outputs: { propertyIds, contactCount: profile.facility_contacts.length },
        };
      },
    },
    {
      key: "score_strategic",
      name: "Score portfolio value",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_operator_account"];
        const profile = ctx.priorOutputs["research_portfolio"].profile as PortfolioProfile;
        const houston = profile.houston_location_count ?? 0;
        const texas = profile.texas_location_count ?? houston;
        const result = scoreStrategic({
          revenuePotential: Math.min(1, texas / 20),
          locationCount: locationCountValue(texas),
          futureVolume: profile.activity_signals.length > 1 ? 0.7 : 0.4,
          repeatability: profile.service_potential === "high" ? 0.9 : 0.6,
          localConcentration: texas ? Math.min(1, houston / Math.max(texas, 1) + 0.2) : 0.4,
          multiTradeFit: 0.8, // portfolio work spans signs + service + interior
          relationshipLeverage: 0,
          referenceValue: 0.5,
        });
        await ctx.db
          .update(accounts)
          .set({ strategicValueScore: result.score, updatedAt: new Date() })
          .where(eq(accounts.id, prior.accountId as string));
        return { kind: "completed", outputs: { strategic: result } };
      },
    },
    {
      key: "create_portfolio_opportunity",
      name: "Create portfolio opportunity",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_operator_account"];
        const profile = ctx.priorOutputs["research_portfolio"].profile as PortfolioProfile;
        const { opportunity } = await createOpportunity(ctx.db, {
          name: `${prior.operatorName} — portfolio signage program`,
          accountId: prior.accountId as string,
          opportunityType: "facility_portfolio",
          tradeScope: "signage program + service",
          stage: "discovered",
          source: "pb04",
          sourceDetail: profile.incumbent_vendor_note ?? undefined,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { opportunityId: opportunity.id } };
      },
    },
    {
      key: "portfolio_recommendation",
      name: "Portfolio recommendation",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_operator_account"];
        const profile = ctx.priorOutputs["research_portfolio"].profile as PortfolioProfile;
        const strategic = ctx.priorOutputs["score_strategic"].strategic as { score: number; band: string };
        const recommendation = {
          band: strategic.band,
          strategicScore: strategic.score,
          incumbent: profile.incumbent_vendor_note ?? "unknown",
          motion: profile.incumbent_vendor_note
            ? "Incumbent likely exists — position HSC as overflow, local Houston service, and competitive-bid option; do not pitch replacement."
            : "Pitch a centralized Houston signage + service program to facilities leadership; offer a no-commitment portfolio survey of 2–3 sites first.",
          unknownsToResolve: profile.unknowns,
        };
        await emitEvent(ctx.db, {
          eventType: "account.portfolio_recommended",
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
          payload: recommendation,
        });
        await logActivity(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          action: "portfolio.recommended",
          detail: recommendation.motion,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { recommendation } };
      },
    },
  ],
};
