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
          identifyOwner?: boolean;
        };
        let gcName = p.gcName;
        let accountType = "general_contractor";
        // Ownerless permit signals (e.g. TDLR): research who is behind the project
        // first. If research can't establish a company, fail visibly — we never
        // fabricate an owner (§5.4).
        if (!gcName && p.identifyOwner && p.projectName) {
          const { getResearchProvider } = await import("@/lib/integrations/research/provider");
          const { getLLMClient } = await import("@/lib/ai/client");
          const provider = await getResearchProvider();
          const research = await provider.research({
            query:
              `Who is the owner, developer, or general contractor behind the commercial ` +
              `construction project "${p.projectName}"${p.city ? ` in ${p.city}, TX` : " in Texas"}? ` +
              `Look for permit records, news, leasing pages, and contractor announcements.`,
            focus: "identifying the company to contact about signage for this project",
          });
          const { z } = await import("zod");
          const identified = await getLLMClient().generateStructured({
            system:
              "Identify the company behind a construction project from research text. Use ONLY " +
              "the research. status: verified (explicitly stated with source), inferred " +
              "(strongly implied), or unknown (research did not establish it — set company_name " +
              "null). Never guess a company from name similarity.",
            prompt: `RESEARCH:\n${research.text}\n\nSOURCES:\n${research.sources.map((s) => s.url).join("\n")}\n\nWho is behind "${p.projectName}"?`,
            schema: z.object({
              company_name: z.string().nullable(),
              company_role: z.enum(["general_contractor", "developer", "property_owner", "unknown"]),
              status: z.enum(["verified", "inferred", "unknown"]),
              source_note: z.string().nullable(),
            }),
            effort: "low",
          });
          if (!identified.company_name || identified.status === "unknown") {
            throw new Error(
              `Could not identify the owner/GC behind "${p.projectName}" — needs manual research before pursuing`
            );
          }
          gcName = identified.company_name;
          accountType = identified.company_role === "unknown" ? "prospect" : identified.company_role;
        }
        if (!gcName) throw new Error("gcName is required");
        const { account } = await createAccount(ctx.db, {
          name: gcName,
          accountType,
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
        // Pursuing an existing inbox card adopts that opportunity (fills in the
        // resolved account) instead of creating a parallel record.
        let opportunity;
        if (p.opportunityId) {
          const [adopted] = await ctx.db
            .update(opportunities)
            .set({
              accountId: account.id,
              name: `${account.name} — ${project.name}`,
              stage: "researching",
              updatedAt: new Date(),
            })
            .where(eq(opportunities.id, p.opportunityId))
            .returning();
          opportunity = adopted;
        }
        if (!opportunity) {
          opportunity = (
            await createOpportunity(ctx.db, {
              name: `${account.name} — ${project.name}`,
              accountId: account.id,
              projectId: project.id,
              opportunityType: "gc_pursuit",
              tradeScope: p.tradeScope ?? "signage",
              stage: "researching",
              source: "pb01",
              ploybookRunId: ctx.runId,
            })
          ).opportunity;
        }
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
          const draft = ctx.priorOutputs["draft_outreach"].draft as Record<string, unknown> & {
            target_contact?: string;
          };
          const stakeholders = ctx.priorOutputs["stakeholder_map"].stakeholders as StakeholderPlan;
          // Look up the contact's work email (Hunter) so the approval card
          // arrives pre-filled. Never blocks — null means the human finds it.
          let enrichedDraft: Record<string, unknown> = draft;
          if (draft.target_contact) {
            try {
              const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");
              const { accounts: accountsTable } = await import("@/lib/db/schema");
              const { eq: eqOp } = await import("drizzle-orm");
              const account = prior.accountId
                ? await ctx.db.query.accounts.findFirst({
                    where: eqOp(accountsTable.id, prior.accountId as string),
                  })
                : null;
              const domain =
                account?.domain ??
                account?.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
              // "Dustin Jackson, President" → "Dustin Jackson"
              const fullName = draft.target_contact.split(",")[0]?.trim();
              const found = fullName
                ? await findWorkEmail({
                    fullName,
                    domain: domain ?? undefined,
                    company: (prior.accountName as string) ?? undefined,
                  })
                : null;
              if (found) {
                enrichedDraft = {
                  ...draft,
                  suggested_email: found.email,
                  suggested_email_confidence: found.confidence,
                  suggested_email_source: found.source,
                };
              }
            } catch (err) {
              console.warn("[pb01] email enrichment skipped:", (err as Error).message);
            }
          }
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "send_outreach",
              title: `Send outreach: ${prior.accountName} (fit ${fit.score}, ${fit.recommendation})`,
              summary: `Bid-access email drafted for ${prior.projectName}. Missing stakeholder roles: ${stakeholders.missing_roles.join(", ") || "none"}.`,
              proposedAction:
                "Approve to mark outreach ready to send. Sending itself is a separate guarded action.",
              payload: { draft: enrichedDraft, opportunityId: prior.opportunityId },
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
