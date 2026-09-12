import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { createAccount } from "@/lib/actions/entities";
import { researchAccountBrief, type ResearchBrief } from "@/lib/actions/research";
import { buildStakeholderMap } from "@/lib/actions/outreach";
import {
  swarmPlanSchema,
  swarmMessagesSchema,
  validateSwarmMessages,
  type SwarmPlan,
} from "@/lib/actions/swarm";
import { contacts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";
import { OWNER_VOICE } from "@/lib/actions/outreach";

// PB06 — Company Swarm: coordinated multi-contact pursuit of one account.
// Trigger payload: { accountName, website?, context? }
// Hard rules: distinct messages (validated in code), staggered timing, ONE approval
// covering the whole swarm (§16: contacting multiple people at one account needs approval).

export const pb06CompanySwarm: PloybookDefinition = {
  key: "pb06_company_swarm",
  name: "PB06 — Company Swarm",
  description:
    "Coordinated multi-contact account pursuit: discover/rank contacts → per-person hooks and staggered timing → distinct message drafts (similarity-checked) → one swarm approval.",
  version: "1.0",
  triggerTypes: ["manual", "event:account.strategic"],
  steps: [
    {
      key: "resolve_account",
      name: "Resolve account + contacts",
      async run(ctx) {
        const p = ctx.triggerPayload as { accountName?: string; website?: string };
        if (!p.accountName) throw new Error("accountName is required");
        const { account } = await createAccount(ctx.db, {
          name: p.accountName,
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        const existing = await ctx.db.query.contacts.findMany({
          where: eq(contacts.accountId, account.id),
        });
        return {
          kind: "completed",
          outputs: {
            accountId: account.id,
            accountName: account.name,
            website: account.website,
            existingContactCount: existing.length,
          },
        };
      },
    },
    {
      key: "discover_contacts",
      name: "Discover missing contacts",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        if ((prior.existingContactCount as number) >= 3) {
          return { kind: "skipped", reason: "Account already has 3+ contacts" };
        }
        const { brief } = await researchAccountBrief(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          website: prior.website as string | null,
          projectContext: "Company Swarm: need multiple relevant contacts across roles.",
          ploybookRunId: ctx.runId,
        });
        await buildStakeholderMap(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          brief,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { brief } };
      },
    },
    {
      key: "plan_swarm",
      name: "Rank influence + plan hooks/timing",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        const rows = await ctx.db.query.contacts.findMany({
          where: eq(contacts.accountId, prior.accountId as string),
        });
        if (rows.length === 0) {
          throw new Error("No contacts found for this account — research produced none");
        }
        const brief = ctx.priorOutputs["discover_contacts"]?.brief as ResearchBrief | undefined;
        const llm = getLLMClient();
        const plan = await llm.generateStructured({
          system:
            "Plan a coordinated multi-contact pursuit for Houston Sign Crafters. Each person " +
            "gets a DIFFERENT hook grounded in their role; stagger day_offset so contacts are " +
            "not hit simultaneously (spread over 0-10 days). Use ONLY the contacts provided. " +
            "3-5 people max — pick the most influential if more exist.",
          prompt:
            `Account: ${prior.accountName}\n\nContacts:\n` +
            JSON.stringify(
              rows.map((c) => ({
                name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
                title: c.title,
                role_type: c.roleType,
                influence: c.influenceScore,
              }))
            ) +
            (brief ? `\n\nAccount brief signals:\n${JSON.stringify(brief.signals)}` : "") +
            `\n\nPlan the swarm.`,
          schema: swarmPlanSchema,
          effort: "low",
        });
        if (plan.people.length < 2) {
          throw new Error("Swarm needs at least 2 distinct contacts — only found " + plan.people.length);
        }
        return { kind: "completed", outputs: { plan } };
      },
    },
    {
      key: "draft_messages",
      name: "Draft distinct messages",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        const plan = ctx.priorOutputs["plan_swarm"].plan as SwarmPlan;
        const llm = getLLMClient();
        const drafted = await llm.generateStructured({
          system:
            OWNER_VOICE +
            "\n\nDraft one cold email per planned contact for Houston Sign Crafters. Each message: " +
            "≤120 words, in the OWNER'S VOICE above, one routing-question CTA, personalized to " +
            "that person's role and hook — " +
            "the messages must be CLEARLY DIFFERENT from each other in angle and wording. " +
            "Never promise instant quotes or mockups before a survey. No invented facts.",
          prompt:
            `Account: ${prior.accountName}\n\nSwarm plan:\n${JSON.stringify(plan)}\n\nDraft the messages.`,
          schema: swarmMessagesSchema,
          effort: "medium",
        });
        validateSwarmMessages(drafted.messages); // throws on near-duplicates or overlength
        return { kind: "completed", outputs: { messages: drafted.messages } };
      },
    },
    {
      key: "swarm_approval",
      name: "Request swarm approval",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const prior = ctx.priorOutputs["resolve_account"];
          const plan = ctx.priorOutputs["plan_swarm"].plan as SwarmPlan;
          const messages = ctx.priorOutputs["draft_messages"].messages;
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "swarm_outreach",
              title: `Company Swarm: ${prior.accountName} (${plan.people.length} contacts)`,
              summary: plan.sequencing_rationale,
              proposedAction:
                "Approve the full staggered sequence. Sending each message remains a guarded action.",
              payload: { plan, messages },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "record_swarm",
      name: "Record swarm state",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        const decision = ctx.priorOutputs["swarm_approval"].decision as string;
        await emitEvent(ctx.db, {
          eventType: decision === "rejected" ? "swarm.rejected" : "swarm.approved",
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
        });
        await logActivity(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          action: `swarm.${decision}`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { decision } };
      },
    },
  ],
};
