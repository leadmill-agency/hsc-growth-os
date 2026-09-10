import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import { fetchSitemapUrls, findCoveringUrls } from "@/lib/integrations/website/sitemap";
import { saveEvidence } from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// PB16 — Programmatic Local SEO: Geography × Product page, done properly.
// Trigger payload: { matrixInput } e.g. "Richmond × Monument Signs".
// House rules enforced IN CODE (Leadmill playbook): 1,000+ words, real local facts
// only, no unverified stats presented as fact, never near-duplicate mass pages.
// Output is a publish-ready draft behind approval — committing it to the website
// repo stays a human/Claude step.

export const MIN_PAGE_WORDS = 1000;

const pageDraftSchema = z.object({
  title_tag: z.string().max(65),
  meta_description: z.string().max(160),
  h1: z.string(),
  url_slug: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  local_facts_used: z.array(z.object({ fact: z.string(), source: z.string() })),
  unverified_claims_to_confirm: z.array(z.string()),
  internal_link_suggestions: z.array(z.string()),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
});

export type SeoPageDraft = z.infer<typeof pageDraftSchema>;

export function countDraftWords(draft: SeoPageDraft): number {
  const text = [
    draft.h1,
    ...draft.sections.map((s) => `${s.heading} ${s.body}`),
    ...draft.faq.map((f) => `${f.q} ${f.a}`),
  ].join(" ");
  return text.trim().split(/\s+/).length;
}

export const pb16LocalSeo: PloybookDefinition = {
  key: "pb16_local_seo",
  name: "PB16 — Programmatic Local SEO",
  description:
    "Builds one Geography × Product landing page the right way: checks live sitemap coverage, researches real local facts, drafts 1,000+ differentiated words (enforced), and gates publishing behind approval.",
  version: "1.0",
  triggerTypes: ["manual", "scheduled"],
  steps: [
    {
      key: "check_coverage",
      name: "Parse matrix + check existing coverage",
      async run(ctx) {
        const p = ctx.triggerPayload as { matrixInput?: string };
        if (!p.matrixInput) throw new Error("matrixInput is required (e.g. 'Richmond × Monument Signs')");
        const [geoRaw, productRaw] = p.matrixInput.split(/[×x|\/]+/i).map((s) => s?.trim());
        if (!geoRaw || !productRaw) {
          throw new Error("Format: 'City × Product', e.g. 'Richmond × Monument Signs'");
        }
        const urls = await fetchSitemapUrls();
        const covering = findCoveringUrls(urls, [geoRaw, productRaw]);
        if (covering.length > 0) {
          return {
            kind: "skipped",
            reason: `Already covered on the site: ${covering.join(", ")} — improve that page instead of duplicating it`,
          };
        }
        return {
          kind: "completed",
          outputs: { geography: geoRaw, product: productRaw, sitemapSize: urls.length },
        };
      },
    },
    {
      key: "research_local",
      name: "Research real local context",
      async run(ctx) {
        const target = ctx.priorOutputs["check_coverage"];
        if (!target) return { kind: "skipped", reason: "No target" };
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Local facts about ${target.geography}, Texas relevant to commercial signage: ` +
            `commercial growth and new developments, major corridors/retail centers, sign ` +
            `permitting jurisdiction (city or county), notable business districts, and anything ` +
            `specific about ${target.product} demand there.`,
          focus: "differentiated local content for a Houston sign company's city page — facts with sources, no fluff",
        });
        return { kind: "completed", outputs: { researchText: research.text, sources: research.sources } };
      },
    },
    {
      key: "draft_page",
      name: "Draft the page (1,000+ words enforced)",
      async run(ctx) {
        const target = ctx.priorOutputs["check_coverage"];
        const research = ctx.priorOutputs["research_local"];
        if (!target || !research) return { kind: "skipped", reason: "No uncovered target" };
        const llm = getLLMClient();
        const draft = await llm.generateStructured({
          system:
            "Write a local landing page for Houston Sign Crafters (UL-certified, built in " +
            "Houston, 5-year warranty, in-house survey/permit/fabricate/install). HARD RULES: " +
            "1,200+ words across sections; every local claim must come from the research and " +
            "appear in local_facts_used with its source; anything you could not verify goes in " +
            "unverified_claims_to_confirm and is NOT stated as fact in the body; no invented " +
            "stats, prices, or review counts; plain English, front-loaded, active voice, " +
            "sentence-case headings; describe the real sales process (call → survey → mockup " +
            "with itemized estimate) — never instant quotes. This page must be genuinely about " +
            "THIS city — if the local research is thin, write less local color, not fake color.",
          prompt:
            `Page: ${target.product} in ${target.geography}, TX\n\nLOCAL RESEARCH:\n` +
            `${String(research.researchText).slice(0, 12000)}\n\nSOURCES:\n` +
            `${(research.sources as { url: string }[]).map((s) => s.url).join("\n")}\n\nDraft the page.`,
          schema: pageDraftSchema,
          effort: "high",
          maxTokens: 16000,
        });
        const words = countDraftWords(draft);
        if (words < MIN_PAGE_WORDS) {
          throw new Error(`Draft is ${words} words — house minimum for city/product pages is ${MIN_PAGE_WORDS}`);
        }
        return { kind: "completed", outputs: { draft, words } };
      },
    },
    {
      key: "publish_approval",
      name: "Request approval to publish",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const target = ctx.priorOutputs["check_coverage"];
          const drafted = ctx.priorOutputs["draft_page"];
          if (!target || !drafted) return { kind: "skipped", reason: "Nothing drafted" };
          const draft = drafted.draft as SeoPageDraft;
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "publish_page",
              title: `Publish SEO page: ${target.product} in ${target.geography} (${drafted.words} words)`,
              summary:
                draft.unverified_claims_to_confirm.length > 0
                  ? `CONFIRM BEFORE PUBLISH: ${draft.unverified_claims_to_confirm.join("; ")}`
                  : "All local claims carry sources.",
              proposedAction: `Add /${draft.url_slug} to the website repo (human/Claude commits it).`,
              payload: { draft, words: drafted.words },
            },
          };
        }
        return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
      },
    },
    {
      key: "record",
      name: "Record outcome",
      async run(ctx) {
        const target = ctx.priorOutputs["check_coverage"];
        const drafted = ctx.priorOutputs["draft_page"];
        if (!target || !drafted || !ctx.priorOutputs["publish_approval"]) {
          return { kind: "skipped", reason: "Nothing to record" };
        }
        const decision = ctx.priorOutputs["publish_approval"].decision as string;
        await saveEvidence(ctx.db, {
          entityType: "content",
          entityId: "00000000-0000-0000-0000-000000000000",
          fieldName: "seo_page_draft",
          value: { target, draft: drafted.draft, decision },
          sourceName: "pb16",
          verificationStatus: "inferred",
        });
        await emitEvent(ctx.db, {
          eventType: decision === "rejected" ? "content.page_rejected" : "content.page_approved",
          ploybookRunId: ctx.runId,
          payload: { geography: target.geography, product: target.product },
        });
        await logActivity(ctx.db, {
          entityType: "content",
          entityId: "00000000-0000-0000-0000-000000000000",
          action: `seo_page.${decision}`,
          detail: `${target.product} in ${target.geography}`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { decision } };
      },
    },
  ],
};
