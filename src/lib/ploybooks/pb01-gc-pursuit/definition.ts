import type { PloybookDefinition } from "../types";
import { createAccount, createProject, createOpportunity, saveEvidence } from "@/lib/actions/entities";
import { researchAccountBrief, type ResearchBrief } from "@/lib/actions/research";
import {
  buildStakeholderMap,
  buildReadinessChecklist,
  draftOutreach,
  type StakeholderPlan,
} from "@/lib/actions/outreach";
import { scoreGcFit, type GcFitInputs } from "@/lib/scoring/gc-fit";
import { opportunities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB01 — GC Pursuit. The Harvey Golden Path (master PRD §36).
// Trigger payload: { gcName, website?, projectName?, city?, tradeScope?, sourceUrl?,
//                    fitInputs? (partial GcFitInputs overrides) }
// Steps compose shared actions only; outreach never sends without approval.

export const pb01GcPursuit: PloybookDefinition = {
  key: "pb01_gc_pursuit",
  name: "PB01 — GC Pursuit",
  description:
    "Turns a discovered GC/project signal into a qualified pursuit: entities → research → fit score → stakeholder map → readiness checklist → outreach draft → approval bundle.",
  version: "1.0",
  triggerTypes: ["manual", "event:opportunity.pursued"],
  steps: [
    {
      key: "normalize_entities",
      name: "Normalize account, project, opportunity",
      async run(ctx) {
        const p = ctx.triggerPayload as {
          gcName?: string;
          website?: string;
          projectName?: string;
          city?: string;
          tradeScope?: string;
          sourceUrl?: string;
          opportunityId?: string;
        };
        if (!p.gcName) throw new Error("gcName is required");
        const { account } = await createAccount(ctx.db, {
          name: p.gcName,
          accountType: "general_contractor",
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        const { project } = await createProject(ctx.db, {
          name: p.projectName ?? `${p.gcName} — unnamed project`,
          city: p.city ?? "Houston",
          state: "TX",
          stage: "bidding",
          gcAccountId: account.id,
          source: "pb01",
          sourceUrl: p.sourceUrl,
          ploybookRunId: ctx.runId,
        });
        const { opportunity } = await createOpportunity(ctx.db, {
          name: `${account.name} — ${project.name}`,
          accountId: account.id,
          projectId: project.id,
          opportunityType: "gc_pursuit",
          tradeScope: p.tradeScope ?? "signage",
          stage: "researching",
          source: "pb01",
          ploybookRunId: ctx.runId,
        });
        if (p.sourceUrl) {
          await saveEvidence(ctx.db, {
            entityType: "opportunity",
            entityId: opportunity.id,
            fieldName: "origin_signal",
            value: p.sourceUrl,
            sourceUrl: p.sourceUrl,
            verificationStatus: "verified",
          });
        }
        return {
          kind: "completed",
          outputs: {
            accountId: account.id,
            accountName: account.name,
            website: account.website,
            projectId: project.id,
            projectName: project.name,
            opportunityId: opportunity.id,
          },
        };
      },
    },
    {
      key: "research",
      name: "Research GC and project",
      async run(ctx) {
        const prior = ctx.priorOutputs["normalize_entities"];
        const { brief, sources } = await researchAccountBrief(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          website: prior.website as string | null,
          projectContext: `Project: ${prior.projectName}. Trade: signage/awnings.`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { brief, sources } };
      },
    },
    {
      key: "score_fit",
      name: "Score pursuit fit",
      async run(ctx) {
        const p = ctx.triggerPayload as { fitInputs?: Partial<GcFitInputs> };
        const brief = ctx.priorOutputs["research"].brief as ResearchBrief;
        const defaults: GcFitInputs = {
          geography: brief.company.houston_presence ? 1 : 0.5,
          tradeFit: 1,
          projectValue: 0.6,
          gcStrategicValue: brief.projects.length > 1 ? 0.8 : 0.5,
          relationship: 0,
          timing: 0.8,
          capacity: 0.8,
          qualificationReadiness: 0.5,
          futureAccountValue: brief.hsc_fit.repeatability ? 0.7 : 0.4,
        };
        const result = scoreGcFit({ ...defaults, ...p.fitInputs });
        const opportunityId = ctx.priorOutputs["normalize_entities"].opportunityId as string;
        await ctx.db
          .update(opportunities)
          .set({
            fitScore: result.score,
            overallScore: result.score,
            nextAction: result.recommendation,
            updatedAt: new Date(),
          })
          .where(eq(opportunities.id, opportunityId));
        await logActivity(ctx.db, {
          entityType: "opportunity",
          entityId: opportunityId,
          action: "opportunity.scored",
          detail: `Fit ${result.score} → ${result.recommendation}. +${result.topPositive.join(", ")} / −${result.topNegative.join(", ")}`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { fit: result } };
      },
    },
    {
      key: "stakeholder_map",
      name: "Build stakeholder map",
      async run(ctx) {
        const prior = ctx.priorOutputs["normalize_entities"];
        const brief = ctx.priorOutputs["research"].brief as ResearchBrief;
        const plan = await buildStakeholderMap(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          brief,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { stakeholders: plan } };
      },
    },
    {
      key: "readiness_checklist",
      name: "Vendor readiness checklist",
      async run(ctx) {
        const brief = ctx.priorOutputs["research"].brief as ResearchBrief;
        const gcRequirements = brief.unknowns.filter((u) =>
          /prequal|vendor|insurance|bond|portal/i.test(u)
        );
        const checklist = buildReadinessChecklist(gcRequirements);
        return { kind: "completed", outputs: { checklist } };
      },
    },
    {
      key: "draft_outreach",
      name: "Draft outreach",
      async run(ctx) {
        const prior = ctx.priorOutputs["normalize_entities"];
        const brief = ctx.priorOutputs["research"].brief as ResearchBrief;
        const stakeholders = ctx.priorOutputs["stakeholder_map"].stakeholders as StakeholderPlan;
        const draft = await draftOutreach({
          accountName: prior.accountName as string,
          projectName: prior.projectName as string,
          brief,
          stakeholders,
        });
        if (draft.word_count > 150) {
          throw new Error(`Outreach draft too long (${draft.word_count} words; max 150)`);
        }
        return { kind: "completed", outputs: { draft } };
      },
    },
    {
      key: "approval_bundle",
      name: "Request approval to send outreach",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const prior = ctx.priorOutputs["normalize_entities"];
          const fit = ctx.priorOutputs["score_fit"].fit as { score: number; recommendation: string };
          const draft = ctx.priorOutputs["draft_outreach"].draft;
          const stakeholders = ctx.priorOutputs["stakeholder_map"].stakeholders as StakeholderPlan;
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "send_outreach",
              title: `Send outreach: ${prior.accountName} (fit ${fit.score}, ${fit.recommendation})`,
              summary: `Bid-access email drafted for ${prior.projectName}. Missing stakeholder roles: ${stakeholders.missing_roles.join(", ") || "none"}.`,
              proposedAction:
                "Approve to mark outreach ready to send. Sending itself is a separate guarded action.",
              payload: { draft, opportunityId: prior.opportunityId },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "record_outcome",
      name: "Record pursuit state",
      async run(ctx) {
        const prior = ctx.priorOutputs["normalize_entities"];
        const decision = ctx.priorOutputs["approval_bundle"].decision as string;
        const opportunityId = prior.opportunityId as string;
        const newStage = decision === "rejected" ? "qualified" : "pursuing";
        await ctx.db
          .update(opportunities)
          .set({ stage: newStage, updatedAt: new Date() })
          .where(eq(opportunities.id, opportunityId));
        await emitEvent(ctx.db, {
          eventType: decision === "rejected" ? "outreach.rejected" : "outreach.approved",
          opportunityId,
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { stage: newStage, decision } };
      },
    },
  ],
};
