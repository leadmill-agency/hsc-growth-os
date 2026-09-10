import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import {
  FixtureResearchProvider,
  setResearchProviderForTests,
} from "@/lib/integrations/research/provider";
import { setSitemapForTests, findCoveringUrls } from "@/lib/integrations/website/sitemap";
import { gatherWeeklyMetrics, pb18RanThisWeek } from "./pb18-growth-operator/definition";
import {
  accounts,
  opportunities,
  bids,
  approvals,
  evidence,
  events,
  ploybookRuns,
  ploybookSteps,
} from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";

// Phase 6/7 gate (master PRD §26): find a real SEO gap → generate one location/
// product page and one informational page, both draft until approved; the weekly
// brief reads actual system data and recommends runnable actions.

let db: Db;

function longBody(sentences: number): string {
  const parts: string[] = [];
  for (let i = 0; i < sentences; i++) {
    parts.push(
      `Sentence ${i} covers a concrete detail about commercial signage work in this market with specifics that make the section genuinely useful to a local buyer.`
    );
  }
  return parts.join(" ");
}

const seoDraftFixture = {
  title_tag: "Monument Signs in Richmond, TX | Houston Sign Crafters",
  meta_description: "Monument signs designed, permitted, and installed for Richmond businesses.",
  h1: "Monument signs in Richmond, TX",
  url_slug: "monument-signs-richmond-tx",
  sections: [
    { heading: "Why Richmond storefronts invest in monument signs", body: longBody(20) },
    { heading: "Permitting in Richmond and Fort Bend County", body: longBody(20) },
    { heading: "Our process", body: longBody(15) },
  ],
  local_facts_used: [{ fact: "Richmond is in Fort Bend County", source: "https://example.com" }],
  unverified_claims_to_confirm: ["Confirm current Richmond permit fee schedule"],
  internal_link_suggestions: ["/services/monument-signs"],
  faq: [{ q: "How long does a monument sign take?", a: longBody(4) }],
};

const articleDraftFixture = {
  title_tag: "What drives channel letter cost in Houston",
  meta_description: "The real factors behind channel letter pricing.",
  h1: "Channel letter cost in Houston: what actually drives the price",
  url_slug: "channel-letter-cost-houston",
  search_intent: "commercial buyer researching pricing",
  direct_answer_first_paragraph: longBody(4),
  sections: [
    { heading: "Size and mounting", body: longBody(14) },
    { heading: "Lighting and electrical", body: longBody(14) },
    { heading: "Permits", body: longBody(10) },
  ],
  facts_used: [{ fact: "Illuminated signs need electrical permits in Houston", source: "https://example.com" }],
  unverified_claims_to_confirm: ["Any specific dollar ranges before publishing"],
  hsc_examples_needed: ["A recent Houston channel letter install with photos"],
  internal_link_suggestions: ["/services/channel-letters"],
};

const briefFixture = {
  headline: "Radar is filling the inbox; approvals are the bottleneck",
  what_changed: ["12 opportunities discovered (9 tdlr)", "2 bids in estimating", "5 approvals pending"],
  recommendations: [
    { action: "Clear the approvals inbox", ploybook_key: null, target: "Approvals", reason: "5 items waiting on a human", priority: 1 },
    { action: "Pursue Texas City ISD press box", ploybook_key: "pb01_gc_pursuit", target: "Texas City ISD", reason: "Score 78, unactioned", priority: 2 },
  ],
  watchouts: ["No bids submitted this week"],
};

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setResearchProviderForTests(
    new FixtureResearchProvider(() => ({ text: "Local research facts.", sources: [{ url: "https://example.com" }] }))
  );
});

afterEach(() => {
  setLLMClientForTests(null);
  setResearchProviderForTests(null);
  setSitemapForTests(null);
});

describe("sitemap coverage", () => {
  it("finds covering URLs loosely", () => {
    const urls = ["https://houstonsigncrafters.com/locations/katy-tx", "https://houstonsigncrafters.com/services/monument-signs"];
    expect(findCoveringUrls(urls, ["Katy"])).toHaveLength(1);
    expect(findCoveringUrls(urls, ["Richmond", "Monument Signs"])).toHaveLength(0);
  });
});

describe("PB16 — Programmatic Local SEO", () => {
  it("skips when the site already covers the matrix cell", async () => {
    setSitemapForTests(["https://houstonsigncrafters.com/locations/richmond-monument-signs"]);
    const runId = await launchRun(db, {
      ploybookKey: "pb16_local_seo",
      triggerPayload: { matrixInput: "Richmond × Monument Signs" },
    });
    expect(await executeRun(db, runId)).toBe("completed");
    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect(steps[0].status).toBe("skipped");
  });

  it("drafts a 1,000+ word page with sourced local facts, gated behind approval", async () => {
    setSitemapForTests(["https://houstonsigncrafters.com/services/monument-signs"]);
    setLLMClientForTests(new FixtureLLMClient({ structured: () => seoDraftFixture }));
    const runId = await launchRun(db, {
      ploybookKey: "pb16_local_seo",
      triggerPayload: { matrixInput: "Richmond × Monument Signs" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.approvalType).toBe("publish_page");
    expect(pending?.summary).toContain("CONFIRM BEFORE PUBLISH"); // unverified claims surfaced
    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");
    const drafts = await db.query.evidence.findMany({ where: eq(evidence.fieldName, "seo_page_draft") });
    expect(drafts).toHaveLength(1);
  });

  it("fails visibly when the draft is under the 1,000-word house minimum", async () => {
    setSitemapForTests([]);
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: () => ({ ...seoDraftFixture, sections: [{ heading: "Short", body: "Too short." }], faq: [] }),
      })
    );
    const runId = await launchRun(db, {
      ploybookKey: "pb16_local_seo",
      triggerPayload: { matrixInput: "Katy × Awnings" },
    });
    expect(await executeRun(db, runId)).toBe("failed");
    const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
    expect(run?.error).toContain("house minimum");
  });
});

describe("PB17 — Content Opportunity", () => {
  it("drafts a front-loaded article with confirm-first flags and example asks", async () => {
    setSitemapForTests([]);
    setLLMClientForTests(new FixtureLLMClient({ structured: () => articleDraftFixture }));
    const runId = await launchRun(db, {
      ploybookKey: "pb17_content_builder",
      triggerPayload: { topicInput: "channel letter cost in Houston" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.summary).toContain("CONFIRM");
    expect(pending?.summary).toContain("ATTACH REAL EXAMPLES");
  });
});

describe("PB18 — Growth Operator", () => {
  it("gathers real metrics and produces a brief with runnable recommendations", async () => {
    // Seed a week of activity
    const [account] = await db.insert(accounts).values({ name: "Seed GC", slug: "seed-gc" }).returning();
    await db.insert(opportunities).values([
      { name: "TDLR opp A", stage: "discovered", source: "tdlr", overallScore: 78 },
      { name: "TDLR opp B", stage: "discovered", source: "tdlr", overallScore: 60 },
      { name: "Manual opp", stage: "pursuing", source: "manual_signal", accountId: account.id },
    ]);
    const [opp] = await db.select().from(opportunities).limit(1);
    await db.insert(bids).values({ opportunityId: opp.id, status: "estimating" });
    await db.insert(approvals).values({ approvalType: "send_outreach", title: "t", status: "pending" });

    const metrics = await gatherWeeklyMetrics(db);
    expect(metrics.opportunities.discovered).toBe(3);
    expect(metrics.opportunities.bySource["tdlr"]).toBe(2);
    expect(metrics.opportunities.activePursuits).toBe(1); // only the pursuing-stage opportunity
    expect(metrics.bids.estimating).toBe(1);
    expect(metrics.approvalsPending).toBe(1);
    expect(metrics.opportunities.topUnactioned[0].name).toBe("TDLR opp A"); // highest score first

    setLLMClientForTests(new FixtureLLMClient({ structured: () => briefFixture }));
    expect(await pb18RanThisWeek(db)).toBe(false);
    const runId = await launchRun(db, { ploybookKey: "pb18_growth_operator" });
    expect(await executeRun(db, runId)).toBe("completed");

    const briefRows = await db.query.evidence.findMany({ where: eq(evidence.fieldName, "weekly_brief") });
    expect(briefRows).toHaveLength(1);
    const stored = briefRows[0].value as { metrics: { opportunities: { discovered: number } }; recommendations: { ploybook_key: string | null }[] };
    expect(stored.metrics.opportunities.discovered).toBe(3); // real numbers ride along
    expect(stored.recommendations.some((r) => r.ploybook_key === "pb01_gc_pursuit")).toBe(true);

    // Weekly guard now trips
    expect(await pb18RanThisWeek(db)).toBe(true);
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("growth.brief_created");
  });
});
