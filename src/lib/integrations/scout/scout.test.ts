import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { runExpansionScout } from "./client";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import {
  FixtureResearchProvider,
  setResearchProviderForTests,
} from "@/lib/integrations/research/provider";
import { processEvents } from "@/lib/events/subscriptions";
import { accounts, opportunities, ploybookRuns, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { oakberryProfile } from "@/fixtures/phase2";

// The daily Expansion Scout (per Rameel: web scanning IS the value add):
// scout finds a franchise expansion → radar scores it → auto-routing runs PB03
// research with zero clicks — child location opportunities and a rollout
// recommendation appear by themselves.

let db: Db;

const scoutExtraction = {
  discoveries: [
    {
      company_name: "OAKBERRY",
      category: "franchise",
      headline: "Planning nearly 100 Texas stores via Rand Group master franchise",
      texas_scale: "~100 locations",
      houston_relevance: "Houston Heights under construction",
      source_url: "https://news.example/oakberry",
      status: "verified",
    },
    {
      company_name: "Rumor Brand",
      category: "franchise",
      headline: "Might expand someday",
      texas_scale: null,
      houston_relevance: null,
      source_url: null,
      status: "assumed", // must be discarded
    },
  ],
};

const radarParse = {
  company_name: "OAKBERRY",
  company_type: "franchise",
  project_name: null,
  project_address: null,
  city: "Houston",
  trade_relevance: "likely_signage",
  opportunity_type: "franchise expansion",
  estimated_construction_value_usd: null,
  estimated_relevance_score: 82,
  why_this_matters: "100-store Texas rollout with Houston sites in construction — repeatable signage program.",
  suggested_ploybook: "pb03",
  unknowns: [],
};

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setResearchProviderForTests(
    new FixtureResearchProvider(() => ({ text: "Scout research text.", sources: [{ url: "https://news.example" }] }))
  );
  setLLMClientForTests(
    new FixtureLLMClient({
      structured: (prompt: string) => {
        if (prompt.includes("Extract the discoveries")) return scoutExtraction;
        if (prompt.includes("SIGNAL:")) return radarParse;
        if (prompt.includes("expansion profile")) return oakberryProfile;
        throw new Error(`No fixture: ${prompt.slice(0, 50)}`);
      },
    })
  );
});

afterEach(() => {
  setLLMClientForTests(null);
  setResearchProviderForTests(null);
  delete process.env.AUTO_PURSUE_THRESHOLD;
});

describe("Expansion Scout → radar → auto PB03", () => {
  it("feeds verified discoveries into the radar, discards assumed ones, dedupes on re-run", async () => {
    const results = await runExpansionScout(db, { maxQueries: 1, maxSignals: 5 });
    expect(results).toHaveLength(1); // assumed discovery discarded
    expect(results[0].company).toBe("OAKBERRY");
    expect(await db.select().from(opportunities)).toHaveLength(1);
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("radar.scout_ran");

    // Tomorrow's scout finds OAKBERRY again → account-level dedupe, still 1 opportunity
    await runExpansionScout(db, { maxQueries: 1, maxSignals: 5 });
    expect(await db.select().from(opportunities)).toHaveLength(1);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("auto-routes the high-scoring franchise discovery into PB03 research (zero clicks)", async () => {
    process.env.AUTO_PURSUE_THRESHOLD = "75";
    await runExpansionScout(db, { maxQueries: 1, maxSignals: 5 });
    await processEvents(db); // the scheduler's event pass

    // PB03 ran automatically off the discovery
    const runs = await db.query.ploybookRuns.findMany({
      where: eq(ploybookRuns.ploybookKey, "pb03_franchise_expansion"),
    });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("completed");
    expect(runs[0].triggerType).toBe("event:auto_pursue");

    // Its research produced the child location opportunities + strategic score
    const allOpps = await db.select().from(opportunities);
    expect(allOpps.length).toBeGreaterThan(1); // brand-level + child locations
    const [brand] = await db.select().from(accounts).where(eq(accounts.accountType, "franchise"));
    expect(brand.strategicValueScore).toBeGreaterThan(0);
  });
});
