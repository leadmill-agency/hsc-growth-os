import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import {
  FixtureResearchProvider,
  setResearchProviderForTests,
} from "@/lib/integrations/research/provider";
import {
  oakberryResearchText,
  oakberryProfile,
  hcaResearchText,
  hcaProfile,
  manvelResearchText,
  manvelProfile,
} from "@/fixtures/phase2";
import {
  accounts,
  projects,
  properties,
  opportunities,
  relationships,
  contacts,
  ploybookSteps,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

// Phase 2 gate (master PRD §26): for one live example of each of PB02/PB03/PB04 —
// create parent account/project, map related entities, generate child opportunities,
// calculate strategic value, produce pursuit recommendation.

let db: Db;

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setResearchProviderForTests(
    new FixtureResearchProvider((query) => {
      if (query.includes("OAKBERRY")) return { text: oakberryResearchText, sources: [{ url: "https://oakberry.com" }] };
      if (query.includes("HCA")) return { text: hcaResearchText, sources: [{ url: "https://hcahoustonhealthcare.com" }] };
      if (query.includes("Manvel")) return { text: manvelResearchText, sources: [{ url: "https://weitzmangroup.com" }] };
      throw new Error(`No research fixture for query: ${query.slice(0, 60)}`);
    })
  );
  setLLMClientForTests(
    new FixtureLLMClient({
      structured: (prompt: string) => {
        if (prompt.includes("expansion profile")) return oakberryProfile;
        if (prompt.includes("portfolio profile")) return hcaProfile;
        if (prompt.includes("development profile")) return manvelProfile;
        throw new Error(`No structured fixture for prompt: ${prompt.slice(0, 60)}`);
      },
    })
  );
});

afterEach(() => {
  setLLMClientForTests(null);
  setResearchProviderForTests(null);
});

async function stepOutputs(runId: string, stepKey: string) {
  const step = await db.query.ploybookSteps.findFirst({
    where: eq(ploybookSteps.runId, runId),
    orderBy: asc(ploybookSteps.stepOrder),
  });
  const steps = await db.query.ploybookSteps.findMany({ where: eq(ploybookSteps.runId, runId) });
  const match = steps.find((s) => s.stepKey === stepKey) ?? step;
  return (match?.outputs ?? {}) as Record<string, unknown>;
}

describe("PB03 — OAKBERRY franchise expansion", () => {
  it("creates the brand, scores it, creates only evidence-backed child locations, recommends the franchisee motion", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb03_franchise_expansion",
      triggerPayload: { brandName: "OAKBERRY" },
    });
    expect(await executeRun(db, runId)).toBe("completed");

    const [brand] = await db.select().from(accounts).where(eq(accounts.accountType, "franchise"));
    expect(brand.name).toBe("OAKBERRY");
    expect(brand.strategicValueScore).toBeGreaterThan(0);

    // 3 announced openings in fixture, 1 is "assumed" → only 2 become records
    const projectRows = await db.select().from(projects);
    expect(projectRows).toHaveLength(2);
    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(2);
    expect(opps.every((o) => o.opportunityType === "franchise_location")).toBe(true);

    const rels = await db.select().from(relationships);
    expect(rels.filter((r) => r.relationshipType === "EXPANDING_AT")).toHaveLength(2);

    const rec = (await stepOutputs(runId, "rollout_recommendation")).recommendation as {
      motion: string;
      buyingPath: string;
    };
    expect(rec.buyingPath).toBe("franchisee");
    expect(rec.motion).toContain("franchisee");
  });
});

describe("PB04 — HCA CareNow facility portfolio", () => {
  it("creates operator, properties, contacts, portfolio opportunity, and an incumbent-aware recommendation", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb04_facility_portfolio",
      triggerPayload: { operatorName: "HCA Houston Healthcare" },
    });
    expect(await executeRun(db, runId)).toBe("completed");

    const [operator] = await db.select().from(accounts);
    expect(operator.accountType).toBe("facility_operator");
    expect(operator.strategicValueScore).toBeGreaterThan(50); // 40 TX locations, high service potential

    // 3 known locations, 1 assumed → 2 properties
    const props = await db.select().from(properties);
    expect(props).toHaveLength(2);

    const contactRows = await db.select().from(contacts);
    expect(contactRows).toHaveLength(1);
    expect(contactRows[0].firstName).toBe("Jaime");

    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(1);
    expect(opps[0].opportunityType).toBe("facility_portfolio");

    const rec = (await stepOutputs(runId, "portfolio_recommendation")).recommendation as {
      motion: string;
    };
    // Incumbent noted in fixture → must NOT pitch replacement
    expect(rec.motion).toContain("overflow");
  });
});

describe("PB02 — Manvel Town Center development", () => {
  it("maps players and tenants into linked records, labels the revenue estimate an assumption, anchors on the developer", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb02_commercial_development",
      triggerPayload: { developmentName: "Manvel Town Center", city: "Manvel" },
    });
    expect(await executeRun(db, runId)).toBe("completed");

    // Players: developer + architect verified/inferred; assumed GC excluded.
    const accountRows = await db.select().from(accounts);
    const names = accountRows.map((a) => a.name);
    expect(names).toContain("Weitzman");
    expect(names).toContain("DXU Architects");
    expect(names).not.toContain("Unknown GC LLC");

    // Tenants: 2 verified become child opportunities; assumed one excluded
    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(2);
    expect(opps.every((o) => o.opportunityType === "tenant_signage")).toBe(true);

    const rels = await db.select().from(relationships);
    expect(rels.some((r) => r.relationshipType === "DEVELOPER_OF")).toBe(true);
    expect(rels.filter((r) => r.relationshipType === "TENANT_AT")).toHaveLength(2);

    const rec = (await stepOutputs(runId, "development_recommendation")).recommendation as {
      motion: string;
      revenueRange: string;
      tenantOpportunities: number;
    };
    expect(rec.motion).toContain("Weitzman");
    expect(rec.revenueRange).toContain("ASSUMPTION"); // estimates never presented as fact
    expect(rec.tenantOpportunities).toBe(2);
  });
});
