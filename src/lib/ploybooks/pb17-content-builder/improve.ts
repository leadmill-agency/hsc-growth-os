import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import { emitEvent, logActivity } from "@/lib/events";

// PB17b — Page Improvement (Rameel 2026-10-15). When a page already ranks 4th–
// 30th for real searches, adding the missing answer to THAT page moves it faster
// than a new article (which would compete with it). Trigger payload:
// { targetPage: "/services/channel-letters", queries: [{query, impressions, position}], reasons: [] }
// The draft lands in the Outbox as `improve_page`; the weekly publish task
// (Claude, Tuesdays) verifies facts and edits the live page.

const SITE = "https://houstonsigncrafters.com";
export const MIN_IMPROVEMENT_WORDS = 150;

const improvementSchema = z.object({
  summary: z.string(), // plain English: why it isn't ranking higher, what this adds
  query_intent: z.array(
    z.object({ query: z.string(), what_searcher_wants: z.string(), already_answered: z.boolean() })
  ),
  new_sections: z.array(
    z.object({ heading: z.string(), body: z.string(), place_after_heading: z.string().optional() })
  ),
  new_faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  title_tag_suggestion: z.string().optional(),
  meta_description_suggestion: z.string().optional(),
  internal_links_to_add: z.array(z.object({ from_page: z.string(), anchor_text: z.string() })),
  facts_used: z.array(z.object({ fact: z.string(), source: z.string() })),
  unverified_claims_to_confirm: z.array(z.string()),
});

export type ImprovementDraft = z.infer<typeof improvementSchema>;

export function countImprovementWords(d: ImprovementDraft): number {
  const text = [
    ...d.new_sections.map((s) => `${s.heading} ${s.body}`),
    ...d.new_faqs.map((f) => `${f.q} ${f.a}`),
  ].join(" ");
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Visible text + headings of a live page's <main>, for "don't repeat it" context. */
export function extractPageText(html: string): { text: string; headings: string[]; words: number } {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html;
  const clean = main.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const headings = [...clean.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  );
  const text = clean
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return { text, headings, words: text ? text.split(" ").length : 0 };
}

type Query = { query: string; impressions: number; position: number };

export const pb17PageImprover: PloybookDefinition = {
  key: "pb17_page_improver",
  name: "PB17b — Page Improvement (rank gaps)",
  description:
    "Takes a page that already ranks 4th–30th for real Search Console queries and drafts the sections and FAQs it's missing, so the existing page climbs instead of a new page competing with it. Publish behind approval.",
  version: "1.0",
  triggerTypes: ["manual", "scheduled"],
  steps: [
    {
      key: "load_page",
      name: "Read the live page",
      async run(ctx) {
        const p = ctx.triggerPayload as { targetPage?: string; queries?: Query[] };
        if (!p.targetPage || !p.queries?.length) throw new Error("targetPage and queries are required");
        const res = await fetch(`${SITE}${p.targetPage}`, { headers: { "User-Agent": "HSC-GrowthOS/1.0" } });
        if (!res.ok) throw new Error(`Could not load ${p.targetPage}: HTTP ${res.status}`);
        const page = extractPageText(await res.text());
        return { kind: "completed", outputs: { targetPage: p.targetPage, queries: p.queries, ...page } };
      },
    },
    {
      key: "research",
      name: "Research what searchers want",
      async run(ctx) {
        const page = ctx.priorOutputs["load_page"];
        const queries = (page.queries as Query[]).map((q) => `"${q.query}"`).join(", ");
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Houston commercial sign buyers search for ${queries}. What do they want to know before ` +
            `hiring a sign company? Include facts that are true for Houston and Texas (permits, codes, ` +
            `materials, timelines, what affects cost) with sources, and common questions.`,
          focus: "accurate, source-backed buyer answers — no marketing fluff",
        });
        return { kind: "completed", outputs: { researchText: research.text, sources: research.sources } };
      },
    },
    {
      key: "draft_improvement",
      name: "Draft the missing sections and FAQs",
      async run(ctx) {
        const page = ctx.priorOutputs["load_page"];
        const research = ctx.priorOutputs["research"];
        const queries = page.queries as Query[];
        const llm = getLLMClient();
        const draft = await llm.generateStructured({
          system:
            "You improve an existing page on Houston Sign Crafters' website so it ranks higher for " +
            "searches it already shows up for. HARD RULES: add only what the page is MISSING for " +
            "these searches (you are given the current text; never repeat it); 300–700 new words " +
            "across new sections and FAQs; answer-first, plain English, short sentences, " +
            "sentence-case headings that use the searcher's own wording where natural; every fact " +
            "comes from the research and is listed in facts_used with its source; never invent " +
            "prices, stats, project counts, or past work — put anything a human must confirm in " +
            "unverified_claims_to_confirm; the real process is call → site survey → mockup with " +
            "itemized estimate, never instant quotes; never say HSC outsources work; no em dashes. " +
            "Suggest a new title tag or meta description only if the current one clearly misses " +
            "the main search.",
          prompt:
            `PAGE: ${SITE}${page.targetPage}\n` +
            `SEARCHES IT SHOWS UP FOR (28 days):\n` +
            queries.map((q) => `- "${q.query}": ${q.impressions} impressions, average position ${q.position}`).join("\n") +
            `\n\nCURRENT HEADINGS:\n${(page.headings as string[]).join("\n")}\n\n` +
            `CURRENT PAGE TEXT (${page.words} words):\n${String(page.text).slice(0, 14000)}\n\n` +
            `RESEARCH:\n${String(research.researchText).slice(0, 10000)}\n\n` +
            `SOURCES:\n${(research.sources as { url: string }[]).map((s) => s.url).join("\n")}\n\n` +
            "Draft the improvement.",
          schema: improvementSchema,
          effort: "high",
          maxTokens: 12000,
        });
        const words = countImprovementWords(draft);
        if (words < MIN_IMPROVEMENT_WORDS) {
          throw new Error(`Improvement adds only ${words} words; minimum is ${MIN_IMPROVEMENT_WORDS}`);
        }
        return { kind: "completed", outputs: { draft, words } };
      },
    },
    {
      key: "publish_approval",
      name: "Request approval to apply",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const page = ctx.priorOutputs["load_page"];
          const drafted = ctx.priorOutputs["draft_improvement"];
          const queries = page.queries as Query[];
          const draft = drafted.draft as ImprovementDraft;
          const totalImpr = queries.reduce((a, q) => a + q.impressions, 0);
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "improve_page",
              title: `Improve page: ${page.targetPage} for "${queries[0].query}" (${queries.length} searches, ${totalImpr} impressions, +${drafted.words} words)`,
              summary:
                [
                  draft.summary,
                  draft.unverified_claims_to_confirm.length
                    ? `CONFIRM: ${draft.unverified_claims_to_confirm.join("; ")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
              proposedAction: `Add the new sections and FAQs to ${page.targetPage} (the weekly publish task applies it).`,
              payload: {
                targetPage: page.targetPage,
                queries,
                reasons: (ctx.triggerPayload as { reasons?: string[] }).reasons ?? [],
                draft,
                words: drafted.words,
              },
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
        const page = ctx.priorOutputs["load_page"];
        const decision = ctx.priorOutputs["publish_approval"]?.decision as string | undefined;
        if (!page || !decision) return { kind: "skipped", reason: "Nothing to record" };
        await emitEvent(ctx.db, {
          eventType: decision === "rejected" ? "content.improvement_rejected" : "content.improvement_approved",
          ploybookRunId: ctx.runId,
          payload: { targetPage: page.targetPage },
        });
        await logActivity(ctx.db, {
          entityType: "content",
          entityId: "00000000-0000-0000-0000-000000000000",
          action: `improvement.${decision}`,
          detail: String(page.targetPage),
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { decision } };
      },
    },
  ],
};
