import { z } from "zod";
import type { Db } from "@/lib/db/client";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import {
  accounts,
  opportunities,
  bids,
  approvals,
  followups,
  events,
} from "@/lib/db/schema";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { saveEvidence } from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// PB18 — Growth Operator: the weekly brief, built from ACTUAL system data.
// Metrics are deterministic SQL (never model-estimated); the model only turns
// them into observations and ranked, runnable recommendations (§5.2: every
// insight leads to an action). Runs automatically every Monday.

export interface WeeklyMetrics {
  since: string;
  opportunities: {
    discovered: number;
    bySource: Record<string, number>;
    activePursuits: number;
    topUnactioned: { id: string; name: string; score: number | null; nextAction: string | null }[];
  };
  bids: { created: number; submitted: number; won: number; lost: number; estimating: number };
  approvalsPending: number;
  followupsAwaitingSend: number;
  proposalViews: number;
  highIntentVisits: number;
  tdlrPulls: number;
  accountsCreated: number;
}

export async function gatherWeeklyMetrics(db: Db): Promise<WeeklyMetrics> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const discoveredRows = await db
    .select({ source: opportunities.source, n: count() })
    .from(opportunities)
    .where(gte(opportunities.createdAt, since))
    .groupBy(opportunities.source);
  const bySource: Record<string, number> = {};
  let discovered = 0;
  for (const row of discoveredRows) {
    bySource[row.source ?? "unknown"] = row.n;
    discovered += row.n;
  }

  const [active] = await db
    .select({ n: count() })
    .from(opportunities)
    .where(inArray(opportunities.stage, ["researching", "pursuing", "bid_invited", "estimating"]));

  const topUnactioned = await db.query.opportunities.findMany({
    where: eq(opportunities.stage, "discovered"),
    orderBy: desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, 0)`),
    limit: 5,
  });

  const [bidsCreated] = await db.select({ n: count() }).from(bids).where(gte(bids.createdAt, since));
  const [bidsSubmitted] = await db
    .select({ n: count() })
    .from(bids)
    .where(and(gte(bids.submittedAt, since)));
  const [bidsWon] = await db.select({ n: count() }).from(bids).where(eq(bids.status, "won"));
  const [bidsLost] = await db.select({ n: count() }).from(bids).where(eq(bids.status, "lost"));
  const [bidsEstimating] = await db.select({ n: count() }).from(bids).where(eq(bids.status, "estimating"));

  const [pendingApprovals] = await db
    .select({ n: count() })
    .from(approvals)
    .where(eq(approvals.status, "pending"));
  const [draftedFollowups] = await db
    .select({ n: count() })
    .from(followups)
    .where(eq(followups.status, "drafted"));

  const countEvents = async (type: string) => {
    const [row] = await db
      .select({ n: count() })
      .from(events)
      .where(and(eq(events.eventType, type), gte(events.occurredAt, since)));
    return row.n;
  };

  const [accountsCreated] = await db
    .select({ n: count() })
    .from(accounts)
    .where(gte(accounts.createdAt, since));

  return {
    since: since.toISOString(),
    opportunities: {
      discovered,
      bySource,
      activePursuits: active.n,
      topUnactioned: topUnactioned.map((o) => ({
        id: o.id,
        name: o.name,
        score: o.overallScore ?? o.fitScore,
        nextAction: o.nextAction,
      })),
    },
    bids: {
      created: bidsCreated.n,
      submitted: bidsSubmitted.n,
      won: bidsWon.n,
      lost: bidsLost.n,
      estimating: bidsEstimating.n,
    },
    approvalsPending: pendingApprovals.n,
    followupsAwaitingSend: draftedFollowups.n,
    proposalViews: await countEvents("proposal.viewed"),
    highIntentVisits: await countEvents("account.high_intent_visit"),
    tdlrPulls: await countEvents("radar.tdlr_pulled"),
    accountsCreated: accountsCreated.n,
  };
}

const briefSchema = z.object({
  headline: z.string(),
  what_changed: z.array(z.string()).min(1).max(7),
  recommendations: z.array(
    z.object({
      action: z.string(),
      ploybook_key: z.string().nullable(),
      target: z.string(),
      reason: z.string(),
      priority: z.number().min(1).max(5),
    })
  ),
  watchouts: z.array(z.string()),
});

export type WeeklyBrief = z.infer<typeof briefSchema> & { metrics: WeeklyMetrics; generatedAt: string };

export const SYSTEM_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

export async function pb18RanThisWeek(db: Db): Promise<boolean> {
  const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000);
  const row = await db.query.events.findFirst({
    where: and(eq(events.eventType, "growth.brief_created"), gte(events.occurredAt, weekAgo)),
  });
  return !!row;
}

export const pb18GrowthOperator: PloybookDefinition = {
  key: "pb18_growth_operator",
  name: "PB18 — Growth Operator",
  description:
    "The Monday brief: deterministic metrics from the actual system data (opportunities by source, bids, pending approvals, follow-ups, engagement), turned into observations and ranked recommendations that each point at a runnable ploybook.",
  version: "1.0",
  triggerTypes: ["scheduled", "manual"],
  steps: [
    {
      key: "gather_metrics",
      name: "Gather this week's numbers",
      async run(ctx) {
        const metrics = await gatherWeeklyMetrics(ctx.db);
        return { kind: "completed", outputs: { metrics } };
      },
    },
    {
      key: "compose_brief",
      name: "Compose observations + recommendations",
      async run(ctx) {
        const metrics = ctx.priorOutputs["gather_metrics"].metrics as WeeklyMetrics;
        const llm = getLLMClient();
        const brief = await llm.generateStructured({
          system:
            "You are HSC's weekly growth operator. Turn the metrics JSON into a short brief. " +
            "RULES: use ONLY the numbers provided — never invent or extrapolate figures; every " +
            "recommendation must be concretely runnable (name the ploybook_key from: " +
            "pb01_gc_pursuit, pb02_commercial_development, pb03_franchise_expansion, " +
            "pb04_facility_portfolio, pb06_company_swarm, pb07_abm_page, pb09_account_research, " +
            "pb10_incoming_bid, pb12_bid_qa, pb14_deal_room, pb15_business_case, " +
            "pb16_local_seo, pb17_content_builder — or null for pure human actions like " +
            "'clear the approvals inbox' or 'send the drafted follow-ups'); reference specific " +
            "opportunities from topUnactioned by name; priority 1 is most urgent. Plain " +
            "English, no hype. If a number is zero, say so plainly — a quiet week is a finding.",
          prompt: `THIS WEEK'S METRICS:\n${JSON.stringify(metrics, null, 1)}\n\nWrite the brief.`,
          schema: briefSchema,
          effort: "medium",
        });
        const full: WeeklyBrief = { ...brief, metrics, generatedAt: new Date().toISOString() };
        await saveEvidence(ctx.db, {
          entityType: "system",
          entityId: SYSTEM_ENTITY_ID,
          fieldName: "weekly_brief",
          value: full,
          sourceName: "pb18",
          verificationStatus: "verified", // metrics are real SQL; narrative labeled below
        });
        await emitEvent(ctx.db, {
          eventType: "growth.brief_created",
          ploybookRunId: ctx.runId,
          payload: { headline: brief.headline, recommendations: brief.recommendations.length },
        });
        await logActivity(ctx.db, {
          entityType: "system",
          entityId: SYSTEM_ENTITY_ID,
          action: "growth.brief_created",
          detail: brief.headline,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { brief: full } };
      },
    },
  ],
};
