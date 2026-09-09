import type { PloybookDefinition } from "../types";
import { createAccount, createOpportunity, saveEvidence } from "@/lib/actions/entities";
import { contacts, opportunities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";

// PB08 — High-Intent Visitor: identified-company website intent → outreach recommendation.
// Trigger payload: { companyName, pagesVisited: string[], visitCount?, source?, website? }
// Fed by /api/visitor (RB2B webhook later) or manual runs. Scoring is deterministic —
// page intent weights per PB08 PRD (pricing/monument/awnings high; careers/blog low).

const HIGH_INTENT_PATTERNS: { pattern: RegExp; weight: number; label: string }[] = [
  { pattern: /pricing|quote|cost/i, weight: 30, label: "pricing" },
  { pattern: /monument/i, weight: 25, label: "monument signs" },
  { pattern: /awning|canop/i, weight: 25, label: "commercial awnings" },
  { pattern: /channel-letters|channel_letters|channelletters/i, weight: 20, label: "channel letters" },
  { pattern: /proposal|deal/i, weight: 30, label: "proposal pages" },
  { pattern: /portfolio|projects/i, weight: 15, label: "portfolio" },
  { pattern: /franchise|multi-location|property-manager|general-contractor/i, weight: 25, label: "multi-location/B2B pages" },
  { pattern: /contact|book|free-mockup|sign-mockup/i, weight: 20, label: "contact/mockup" },
];

const LOW_INTENT_PATTERNS = /careers|blog|privacy|terms/i;

export function scoreVisitorIntent(pagesVisited: string[], visitCount: number) {
  let score = 0;
  const matched: string[] = [];
  for (const page of pagesVisited) {
    if (LOW_INTENT_PATTERNS.test(page)) continue;
    for (const { pattern, weight, label } of HIGH_INTENT_PATTERNS) {
      if (pattern.test(page)) {
        score += weight;
        if (!matched.includes(label)) matched.push(label);
        break;
      }
    }
  }
  score += Math.min(20, Math.max(0, (visitCount - 1) * 10)); // repeat visits
  return { score: Math.min(100, score), matched };
}

export const pb08HighIntentVisitor: PloybookDefinition = {
  key: "pb08_high_intent_visitor",
  name: "PB08 — High-Intent Visitor",
  description:
    "Turns an identified company's website visit into an outreach recommendation: resolve company → deterministic intent score from pages visited → opportunity + recommended next motion (swarm for strategic accounts).",
  version: "1.0",
  triggerTypes: ["manual", "webhook:visitor"],
  steps: [
    {
      key: "resolve_company",
      name: "Resolve company",
      async run(ctx) {
        const p = ctx.triggerPayload as {
          companyName?: string;
          website?: string;
          pagesVisited?: string[];
          visitCount?: number;
          person?: { name?: string; title?: string; linkedinUrl?: string; email?: string };
        };
        if (!p.companyName) throw new Error("companyName is required");
        const { account, created } = await createAccount(ctx.db, {
          name: p.companyName,
          website: p.website,
          ploybookRunId: ctx.runId,
        });
        // RB2B identifies people, not just companies — keep the person as a contact.
        let contactId: string | null = null;
        if (p.person?.name) {
          const [first, ...rest] = p.person.name.split(" ");
          const existing = await ctx.db.query.contacts.findFirst({
            where: and(
              eq(contacts.accountId, account.id),
              eq(contacts.firstName, first),
              eq(contacts.lastName, rest.join(" ") || "")
            ),
          });
          if (existing) {
            contactId = existing.id;
          } else {
            const [contact] = await ctx.db
              .insert(contacts)
              .values({
                accountId: account.id,
                firstName: first,
                lastName: rest.join(" ") || null,
                title: p.person.title,
                linkedinUrl: p.person.linkedinUrl,
                email: p.person.email,
                source: "rb2b",
              })
              .returning();
            contactId = contact.id;
          }
        }
        return {
          kind: "completed",
          outputs: {
            accountId: account.id,
            accountName: account.name,
            knownAccount: !created,
            strategicScore: account.strategicValueScore,
            contactId,
          },
        };
      },
    },
    {
      key: "score_intent",
      name: "Score intent",
      async run(ctx) {
        const p = ctx.triggerPayload as { pagesVisited?: string[]; visitCount?: number };
        const pages = p.pagesVisited ?? [];
        if (pages.length === 0) {
          return { kind: "skipped", reason: "No pages provided with visitor event" };
        }
        const { score, matched } = scoreVisitorIntent(pages, p.visitCount ?? 1);
        const prior = ctx.priorOutputs["resolve_company"];
        await saveEvidence(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          fieldName: "visitor_intent",
          value: { pages, visitCount: p.visitCount ?? 1, score, matched },
          sourceName: "website_visit",
          verificationStatus: "verified",
        });
        await logActivity(ctx.db, {
          entityType: "account",
          entityId: prior.accountId as string,
          action: "visitor.intent_scored",
          detail: `Intent ${score} (${matched.join(", ") || "no high-intent pages"})`,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { score, matched } };
      },
    },
    {
      key: "recommend_action",
      name: "Recommend outreach action",
      async run(ctx) {
        const scored = ctx.priorOutputs["score_intent"];
        if (!scored) return { kind: "skipped", reason: "No intent score" };
        const score = scored.score as number;
        const matched = scored.matched as string[];
        const prior = ctx.priorOutputs["resolve_company"];
        if (score < 40) {
          return {
            kind: "completed",
            outputs: { recommendation: { action: "monitor", reason: `Intent ${score} below threshold` } },
          };
        }
        const { opportunity } = await createOpportunity(ctx.db, {
          name: `${prior.accountName} — website intent (${matched[0] ?? "general"})`,
          accountId: prior.accountId as string,
          opportunityType: "inbound_intent",
          stage: "discovered",
          source: "website_intent",
          ploybookRunId: ctx.runId,
        });
        const strategic = (prior.strategicScore as number | null) ?? 0;
        const recommendation = {
          action: strategic >= 60 ? "launch_pb06_company_swarm" : "draft_single_outreach",
          reason:
            `Intent ${score}: visited ${matched.join(", ")}. ` +
            (prior.knownAccount ? "Known account — reference prior context. " : "New company. ") +
            (strategic >= 60
              ? "Strategic account — coordinate a swarm rather than a single email."
              : "Start with one relevant contact; escalate if engagement continues."),
          opportunityId: opportunity.id,
        };
        await ctx.db
          .update(opportunities)
          .set({ overallScore: score, nextAction: recommendation.action, updatedAt: new Date() })
          .where(eq(opportunities.id, opportunity.id));
        await emitEvent(ctx.db, {
          eventType: "account.high_intent_visit",
          accountId: prior.accountId as string,
          opportunityId: opportunity.id,
          ploybookRunId: ctx.runId,
          payload: { score, matched, recommendation: recommendation.action },
        });
        return { kind: "completed", outputs: { recommendation } };
      },
    },
  ],
};
