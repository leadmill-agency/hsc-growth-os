import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import {
  createAccount,
  createProject,
  createProperty,
  createOpportunity,
  createRelationship,
  saveEvidence,
} from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// PB02 — Commercial Development Pursuit: one development → linked opportunities across
// developer, GC, owner, and tenants. Trigger payload: { developmentName, city?, context?, sourceUrl? }

const evidenceStatus = z.enum(["verified", "inferred", "assumed", "unknown"]);

export const developmentProfileSchema = z.object({
  development_summary: z.string(),
  development_type: z.string(),
  city: z.string().nullable(),
  stage: z.string().nullable(),
  players: z.array(
    z.object({
      name: z.string(),
      role: z.enum(["developer", "property_owner", "general_contractor", "architect", "property_manager"]),
      status: evidenceStatus,
    })
  ),
  // Guard (2026-09-10): PB02 once mapped an elementary school as a retail
  // development and invented tenant pairings for it. The profile must declare
  // what this actually is before any tenant records get created.
  is_multi_tenant_commercial: z.boolean(),
  announced_tenants: z.array(
    z.object({ name: z.string(), category: z.string().nullable(), status: evidenceStatus })
  ),
  estimated_unannounced_tenant_count: z.number().nullable(),
  likely_hsc_scopes: z.array(
    z.enum(["monument", "pylon", "directional", "building_signage", "awnings", "tenant_signage", "wayfinding", "interior"])
  ),
  revenue_estimate_low: z.number().nullable(),
  revenue_estimate_high: z.number().nullable(),
  unknowns: z.array(z.string()),
});

export type DevelopmentProfile = z.infer<typeof developmentProfileSchema>;

const roleToRelationship: Record<string, string> = {
  developer: "DEVELOPER_OF",
  property_owner: "OWNER_OF",
  general_contractor: "GC_ON",
  architect: "ARCHITECT_ON",
  property_manager: "MANAGES",
};

export const pb02CommercialDevelopment: PloybookDefinition = {
  key: "pb02_commercial_development",
  name: "PB02 — Commercial Development Pursuit",
  description:
    "Maps a commercial development into linked pursuits: development record → players (developer/GC/owner/architect) → announced tenants as child opportunities → scope + revenue estimate → strategic recommendation.",
  version: "1.0",
  triggerTypes: ["manual", "event:opportunity.pursued"],
  steps: [
    {
      key: "create_development",
      name: "Create development project + property",
      async run(ctx) {
        const p = ctx.triggerPayload as {
          developmentName?: string;
          city?: string;
          sourceUrl?: string;
        };
        if (!p.developmentName) throw new Error("developmentName is required");
        const { project } = await createProject(ctx.db, {
          name: p.developmentName,
          projectType: "commercial_development",
          city: p.city ?? undefined,
          state: "TX",
          stage: "planning",
          source: "pb02",
          sourceUrl: p.sourceUrl,
          ploybookRunId: ctx.runId,
        });
        const { property } = await createProperty(ctx.db, {
          name: p.developmentName,
          city: p.city ?? undefined,
          type: "commercial_development",
        });
        return {
          kind: "completed",
          outputs: { projectId: project.id, propertyId: property.id, developmentName: project.name },
        };
      },
    },
    {
      key: "research_development",
      name: "Research development and players",
      async run(ctx) {
        const p = ctx.triggerPayload as { context?: string; city?: string };
        const prior = ctx.priorOutputs["create_development"];
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Research the commercial development "${prior.developmentName}"` +
            (p.city ? ` in ${p.city}, TX` : " in Texas") +
            `: developer, property owner, general contractor, architect, property manager, ` +
            `announced tenants, project stage/timeline, and scale (acreage, buildings, retail sqft).` +
            (p.context ? ` Context: ${p.context}` : ""),
          focus: "sign company mapping signage opportunities across a development and its tenants",
        });
        const llm = getLLMClient();
        const profile = await llm.generateStructured({
          system:
            "Extract a development profile for a Houston sign company. Use ONLY the research " +
            "text. is_multi_tenant_commercial: true ONLY for genuine multi-tenant commercial " +
            "developments (retail centers, mixed-use, business parks). Schools, hospitals, " +
            "civic buildings, and single-tenant projects are FALSE and get NO announced_tenants " +
            "— nearby businesses are not tenants of the project. " +
            "Evidence status on every player and tenant. Revenue estimates: only provide " +
            "numbers if the research supports a reasoned range from tenant count and scope; " +
            "they are ASSUMPTIONS and will be labeled as such — null is always acceptable. " +
            "Unestablished facts go in unknowns. Never invent players or tenants.",
          prompt:
            `RESEARCH:\n${research.text}\n\nSOURCES:\n${research.sources.map((s) => s.url).join("\n")}\n\n` +
            `Produce the development profile for ${prior.developmentName}.`,
          schema: developmentProfileSchema,
          effort: "medium",
        });
        return { kind: "completed", outputs: { profile, sources: research.sources } };
      },
    },
    {
      key: "map_players",
      name: "Create player accounts + relationships",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_development"];
        const profile = ctx.priorOutputs["research_development"].profile as DevelopmentProfile;
        const players: { name: string; role: string; accountId: string }[] = [];
        for (const player of profile.players) {
          if (player.status === "assumed" || player.status === "unknown") continue;
          const { account } = await createAccount(ctx.db, {
            name: player.name,
            accountType: player.role,
            ploybookRunId: ctx.runId,
          });
          await createRelationship(ctx.db, {
            fromEntityType: "account",
            fromEntityId: account.id,
            relationshipType: roleToRelationship[player.role] ?? "INVOLVED_IN",
            toEntityType: "project",
            toEntityId: prior.projectId as string,
            source: "pb02",
          });
          players.push({ name: player.name, role: player.role, accountId: account.id });
        }
        return { kind: "completed", outputs: { players } };
      },
    },
    {
      key: "create_tenant_opportunities",
      name: "Create child tenant opportunities",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_development"];
        const profile = ctx.priorOutputs["research_development"].profile as DevelopmentProfile;
        if (!profile.is_multi_tenant_commercial) {
          return {
            kind: "skipped",
            reason:
              "Not a multi-tenant commercial development (school/civic/single-tenant) — no tenant opportunities created",
          };
        }
        const childIds: string[] = [];
        for (const tenant of profile.announced_tenants) {
          if (tenant.status === "assumed" || tenant.status === "unknown") continue;
          const { account } = await createAccount(ctx.db, {
            name: tenant.name,
            accountType: "prospect",
            industry: tenant.category ?? undefined,
            ploybookRunId: ctx.runId,
          });
          const { opportunity } = await createOpportunity(ctx.db, {
            name: `${tenant.name} @ ${prior.developmentName} — tenant signage`,
            accountId: account.id,
            projectId: prior.projectId as string,
            opportunityType: "tenant_signage",
            tradeScope: "tenant signage",
            stage: "discovered",
            source: "pb02",
            ploybookRunId: ctx.runId,
          });
          await createRelationship(ctx.db, {
            fromEntityType: "account",
            fromEntityId: account.id,
            relationshipType: "TENANT_AT",
            toEntityType: "project",
            toEntityId: prior.projectId as string,
            source: "pb02",
          });
          childIds.push(opportunity.id);
        }
        return { kind: "completed", outputs: { childOpportunityIds: childIds } };
      },
    },
    {
      key: "development_recommendation",
      name: "Development-level estimate + recommendation",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_development"];
        const profile = ctx.priorOutputs["research_development"].profile as DevelopmentProfile;
        const players = ctx.priorOutputs["map_players"].players as { name: string; role: string }[];
        const children = ctx.priorOutputs["create_tenant_opportunities"].childOpportunityIds as string[];

        if (profile.revenue_estimate_low != null && profile.revenue_estimate_high != null) {
          await saveEvidence(ctx.db, {
            entityType: "project",
            entityId: prior.projectId as string,
            fieldName: "development_signage_revenue_estimate",
            value: { low: profile.revenue_estimate_low, high: profile.revenue_estimate_high },
            sourceName: "pb02_estimate",
            verificationStatus: "assumed", // an estimate is never a fact (§5.4)
          });
        }
        const developer = players.find((p) => p.role === "developer");
        const gc = players.find((p) => p.role === "general_contractor");
        const recommendation = {
          scopes: profile.likely_hsc_scopes,
          revenueRange:
            profile.revenue_estimate_low != null
              ? `$${profile.revenue_estimate_low.toLocaleString()}–$${(profile.revenue_estimate_high ?? 0).toLocaleString()} (ASSUMPTION)`
              : "insufficient data",
          tenantOpportunities: children.length,
          estimatedUnannouncedTenants: profile.estimated_unannounced_tenant_count,
          motion: developer
            ? `Pursue ${developer.name} (developer) for the development-level package (monument/directional/wayfinding)${gc ? ` and ${gc.name} (GC) for building signage` : ""}; work announced tenants as individual pursuits.`
            : "Identify the developer first — the development-level package is the anchor pursuit.",
          unknownsToResolve: profile.unknowns,
        };
        await emitEvent(ctx.db, {
          eventType: "development.recommended",
          projectId: prior.projectId as string,
          ploybookRunId: ctx.runId,
          payload: recommendation,
        });
        await logActivity(ctx.db, {
          entityType: "project",
          entityId: prior.projectId as string,
          action: "development.recommended",
          detail: recommendation.motion,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { recommendation } };
      },
    },
  ],
};
