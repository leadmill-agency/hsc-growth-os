import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import { fetchSitemapUrls } from "@/lib/integrations/website/sitemap";
import { saveEvidence } from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// PB17 — Content Opportunity + Page Builder: turn a real question/objection into
// a useful article. Trigger payload: { topicInput } e.g. "channel letter cost in
// Houston" or a repeated customer question. House style: plain English, front-
// loaded answers, no unverified stats stated as fact, real sales process only.

export const MIN_ARTICLE_WORDS = 700;

const articleDraftSchema = z.object({
  title_tag: z.string().max(65),
  meta_description: z.string().max(160),
  h1: z.string(),
  url_slug: z.string(),
  search_intent: z.string(),
  direct_answer_first_paragraph: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  facts_used: z.array(z.object({ fact: z.string(), source: z.string() })),
  unverified_claims_to_confirm: z.array(z.string()),
  hsc_examples_needed: z.array(z.string()), // real project examples a human should attach
  internal_link_suggestions: z.array(z.string()),
});

export type ArticleDraft = z.infer<typeof articleDraftSchema>;

export function countArticleWords(draft: ArticleDraft): number {
  const text = [
    draft.direct_answer_first_paragraph,
    ...draft.sections.map((s) => `${s.heading} ${s.body}`),
  ].join(" ");
  return text.trim().split(/\s+/).length;
}

export const pb17ContentBuilder: PloybookDefinition = {
  key: "pb17_content_builder",
  name: "PB17 — Content Opportunity + Page Builder",
  description:
    "Turns a real customer question, sales objection, or search gap into a useful article: intent check, sitemap coverage check, research, front-loaded draft (700+ words enforced), publish behind approval.",
  version: "1.0",
  triggerTypes: ["manual", "scheduled"],
  steps: [
    {
      key: "qualify_topic",
      name: "Qualify topic + coverage check",
      async run(ctx) {
        const p = ctx.triggerPayload as { topicInput?: string };
        if (!p.topicInput) throw new Error("topicInput is required (a question, objection, or search query)");
        const urls = await fetchSitemapUrls();
        const slugGuess = p.topicInput.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
        const covered = urls.find((u) => u.includes(slugGuess));
        if (covered) {
          return { kind: "skipped", reason: `Likely already covered: ${covered}` };
        }
        return { kind: "completed", outputs: { topic: p.topicInput, sitemapSize: urls.length } };
      },
    },
    {
      key: "research_topic",
      name: "Research the real answer",
      async run(ctx) {
        const target = ctx.priorOutputs["qualify_topic"];
        if (!target) return { kind: "skipped", reason: "No topic" };
        const provider = await getResearchProvider();
        const research = await provider.research({
          query:
            `Research to answer this for Houston commercial sign buyers: "${target.topic}". ` +
            `Include what's factually true (codes, permitting authorities, typical processes), ` +
            `what varies case-by-case, and common misconceptions. Houston/Harris County specifics where relevant.`,
          focus: "accurate, source-backed answer content — no marketing fluff",
        });
        return { kind: "completed", outputs: { researchText: research.text, sources: research.sources } };
      },
    },
    {
      key: "draft_article",
      name: "Draft the article (front-loaded, 700+ words)",
      async run(ctx) {
        const target = ctx.priorOutputs["qualify_topic"];
        const research = ctx.priorOutputs["research_topic"];
        if (!target || !research) return { kind: "skipped", reason: "No uncovered topic" };
        const llm = getLLMClient();
        const draft = await llm.generateStructured({
          system:
            "Write an article for Houston Sign Crafters' site answering a real buyer question. " +
            "HARD RULES: answer the question directly in the first paragraph, then earn depth; " +
            "900+ words; every stated fact comes from the research and appears in facts_used " +
            "with its source; pricing may only be discussed as what DRIVES cost, never invented " +
            "dollar figures — any figure you'd want to state goes in " +
            "unverified_claims_to_confirm for a human; where a real HSC project example would " +
            "strengthen a section, name what's needed in hsc_examples_needed instead of " +
            "inventing one; plain English, short sentences, sentence-case headings; the real " +
            "process is call → site survey → mockup with itemized estimate — never imply " +
            "instant quotes.",
          prompt:
            `Question/topic: ${target.topic}\n\nRESEARCH:\n${String(research.researchText).slice(0, 12000)}\n\n` +
            `SOURCES:\n${(research.sources as { url: string }[]).map((s) => s.url).join("\n")}\n\nDraft the article.`,
          schema: articleDraftSchema,
          effort: "high",
          maxTokens: 16000,
        });
        const words = countArticleWords(draft);
        if (words < MIN_ARTICLE_WORDS) {
          throw new Error(`Draft is ${words} words — minimum for articles is ${MIN_ARTICLE_WORDS}`);
        }
        return { kind: "completed", outputs: { draft, words } };
      },
    },
    {
      key: "publish_approval",
      name: "Request approval to publish",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          const target = ctx.priorOutputs["qualify_topic"];
          const drafted = ctx.priorOutputs["draft_article"];
          if (!target || !drafted) return { kind: "skipped", reason: "Nothing drafted" };
          const draft = drafted.draft as ArticleDraft;
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "publish_content",
              title: `Publish article: ${draft.h1} (${drafted.words} words)`,
              summary:
                [
                  draft.unverified_claims_to_confirm.length
                    ? `CONFIRM: ${draft.unverified_claims_to_confirm.join("; ")}`
                    : null,
                  draft.hsc_examples_needed.length
                    ? `ATTACH REAL EXAMPLES: ${draft.hsc_examples_needed.join("; ")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "All facts carry sources.",
              proposedAction: `Add /blog/${draft.url_slug} to the website repo (human/Claude commits it).`,
              payload: { topic: target.topic, draft, words: drafted.words },
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
        const target = ctx.priorOutputs["qualify_topic"];
        const drafted = ctx.priorOutputs["draft_article"];
        if (!target || !drafted || !ctx.priorOutputs["publish_approval"]) return { kind: "skipped", reason: "Nothing to record" };
        const decision = ctx.priorOutputs["publish_approval"].decision as string;
        await saveEvidence(ctx.db, {
          entityType: "content",
          entityId: "00000000-0000-0000-0000-000000000000",
          fieldName: "article_draft",
          value: { topic: target.topic, draft: drafted.draft, decision },
          sourceName: "pb17",
          verificationStatus: "inferred",
        });
        await emitEvent(ctx.db, {
          eventType: decision === "rejected" ? "content.article_rejected" : "content.article_approved",
          ploybookRunId: ctx.runId,
          payload: { topic: target.topic },
        });
        await logActivity(ctx.db, {
          entityType: "content",
          entityId: "00000000-0000-0000-0000-000000000000",
          action: `article.${decision}`,
          detail: String(target.topic),
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { decision } };
      },
    },
  ],
};
