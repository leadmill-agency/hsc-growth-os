import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { createAccount } from "@/lib/actions/entities";
import { researchAccountBrief, type ResearchBrief } from "@/lib/actions/research";
import {
  abmPageContentSchema,
  createAbmPageDraft,
  publishAbmPage,
} from "@/lib/actions/abm-pages";
import { emitEvent } from "@/lib/events";

// PB07 — ABM Account Page: private, noindex, account-specific page.
// Trigger payload: { accountName, website?, context? }
// Rules (PB07): no fabricated personalization, relevant proof only, no generic AI flattery;
// publish requires approval; engagement is tracked at the account level.

const HSC_CAPABILITIES = [
  "channel letters",
  "cabinet signs",
  "monument signs",
  "pylon signs",
  "interior signage",
  "vinyl & wall graphics",
  "awnings & canopies",
  "permitting",
  "surveys",
  "installation",
  "project management",
];

export const pb07AbmPage: PloybookDefinition = {
  key: "pb07_abm_page",
  name: "PB07 — ABM Account Page",
  description:
    "Generates a private, noindex, account-specific page (headline, relevant capabilities, proof, context, one CTA) as a draft; publishing requires approval; views are tracked per account.",
  version: "1.0",
  triggerTypes: ["manual", "ploybook"],
  steps: [
    {
      key: "resolve_account",
      name: "Resolve account + research",
      async run(ctx) {
        const p = ctx.triggerPayload as { accountName?: string; website?: string; context?: string };
        if (!p.accountName) throw new Error("accountName is required");
        const { account } = await createAccount(ctx.db, {
          name: p.accountName,
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        // Reuse existing research when present; run PB09 when the account is blank.
        let brief: ResearchBrief | null = null;
        if (!account.notes) {
          const result = await researchAccountBrief(ctx.db, {
            accountId: account.id,
            accountName: account.name,
            website: account.website,
            projectContext: p.context,
            ploybookRunId: ctx.runId,
          });
          brief = result.brief;
        }
        return {
          kind: "completed",
          outputs: {
            accountId: account.id,
            accountName: account.name,
            accountNotes: account.notes,
            brief,
          },
        };
      },
    },
    {
      key: "compose_page",
      name: "Compose page content",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        const p = ctx.triggerPayload as { context?: string };
        const llm = getLLMClient();
        const content = await llm.generateStructured({
          system:
            "Compose a private account-specific page for Houston Sign Crafters (UL-certified " +
            "sign manufacturer, built in Houston, 5-year warranty, in-house survey/permit/" +
            "fabricate/install). Rules: NO generic flattery, NO fabricated personalization — " +
            "account_context and local_facts may only use facts provided below. Pick only " +
            "capabilities relevant to THIS account from: " +
            HSC_CAPABILITIES.join(", ") +
            ". proof_points: describe the KIND of proof to show and mark every one " +
            "status='needs_real_project' — real portfolio projects are attached by a human. " +
            "Exactly one CTA. Plain English.",
          prompt:
            `Account: ${prior.accountName}\n` +
            `Known context: ${JSON.stringify({
              notes: prior.accountNotes,
              brief: prior.brief,
              extra: p.context ?? null,
            })}\n\nCompose the page.`,
          schema: abmPageContentSchema,
          effort: "medium",
        });
        const { page } = await createAbmPageDraft(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          title: content.headline,
          content,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { pageId: page.id, publicToken: page.publicToken, content } };
      },
    },
    {
      key: "publish_approval",
      name: "Request approval to publish",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const prior = ctx.priorOutputs["resolve_account"];
          const composed = ctx.priorOutputs["compose_page"];
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "publish_page",
              title: `Publish ABM page: ${prior.accountName}`,
              summary:
                "Private noindex page. Proof points are placeholders until real portfolio projects are attached.",
              proposedAction: `Publish at /p/${composed.publicToken}`,
              payload: { pageId: composed.pageId, content: composed.content },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "publish_page",
      name: "Publish (or hold) page",
      async run(ctx) {
        const decision = ctx.priorOutputs["publish_approval"].decision as string;
        const composed = ctx.priorOutputs["compose_page"];
        const prior = ctx.priorOutputs["resolve_account"];
        if (decision === "rejected") {
          return { kind: "completed", outputs: { published: false, url: null } };
        }
        await publishAbmPage(ctx.db, composed.pageId as string);
        await emitEvent(ctx.db, {
          eventType: "abm_page.ready",
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
          payload: { url: `/p/${composed.publicToken}` },
        });
        return { kind: "completed", outputs: { published: true, url: `/p/${composed.publicToken}` } };
      },
    },
  ],
};
