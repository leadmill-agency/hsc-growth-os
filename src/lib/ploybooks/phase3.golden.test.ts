import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import {
  FixtureResearchProvider,
  setResearchProviderForTests,
} from "@/lib/integrations/research/provider";
import { accounts, contacts, approvals, abmPages, interactions, events, opportunities, ploybookRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { messageSimilarity, validateSwarmMessages } from "@/lib/actions/swarm";
import { recordPageView } from "@/lib/actions/abm-pages";
import { scoreVisitorIntent } from "./pb08-high-intent-visitor/definition";
import { harveyBrief } from "@/fixtures/harvey";

// Phase 3 gate (master PRD §26): 3–5 distinct contact messages for one account;
// a private account page whose engagement is recorded; a high-intent visit turned
// into an outreach recommendation.

let db: Db;

const swarmPlanFixture = {
  people: [
    { contact_name: "Ann Alpha", role_type: "preconstruction", influence: 85, hook: "UH bid access", day_offset: 0 },
    { contact_name: "Bob Beta", role_type: "estimator", influence: 75, hook: "signage package pricing", day_offset: 2 },
    { contact_name: "Cara Gamma", role_type: "project_manager", influence: 60, hook: "install coordination", day_offset: 5 },
    { contact_name: "Dan Delta", role_type: "procurement", influence: 55, hook: "vendor onboarding", day_offset: 8 },
  ],
  sequencing_rationale: "Precon first for bid access, then estimator, PM and procurement staggered.",
};

const swarmMessagesFixture = {
  messages: [
    { contact_name: "Ann Alpha", subject: "Bid access — UH signage package", body: "Ann, we saw the UH project lists signage scope. Houston Sign Crafters fabricates and installs in-house here in Houston. Could you add us to the bid list?", day_offset: 0 },
    { contact_name: "Bob Beta", subject: "Signage estimating support", body: "Bob, when the signage package prices, our estimating team can turn a scoped budget quickly from drawings. Want our trade scope sheet?", day_offset: 2 },
    { contact_name: "Cara Gamma", subject: "Install windows on tight schedules", body: "Cara, our install crews are local with our own equipment, which keeps signage off the critical path. Happy to walk through sequencing whenever useful.", day_offset: 5 },
    { contact_name: "Dan Delta", subject: "Vendor onboarding docs", body: "Dan, we would like to get set up in your vendor system ahead of need. Who should receive our COI and qualification package?", day_offset: 8 },
  ],
};

const abmContentFixture = {
  headline: "Signage for Harvey Cleary projects, built in Houston",
  intro: "A short overview of how HSC supports GC signage packages.",
  relevant_capabilities: [
    { capability: "channel letters", why_relevant: "Campus building exterior identity" },
    { capability: "permitting", why_relevant: "Harris County + UH review handled in-house" },
  ],
  account_context: "Harvey Cleary is bidding a UH project whose notice includes signage scope.",
  proof_points: [
    { title: "Institutional exterior signage", detail: "Comparable campus work", status: "needs_real_project" },
  ],
  local_facts: ["HSC fabricates at 1359 E 40th St, Houston"],
  cta_label: "Request our bid package",
  cta_detail: "One email gets you our trade scope sheet and qualification docs.",
};

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setResearchProviderForTests(
    new FixtureResearchProvider(() => ({ text: "Research text.", sources: [{ url: "https://example.com" }] }))
  );
});

afterEach(() => {
  setLLMClientForTests(null);
  setResearchProviderForTests(null);
});

async function seedAccountWithContacts(name: string, contactCount: number) {
  const [account] = await db
    .insert(accounts)
    .values({ name, slug: name.toLowerCase().replace(/\s+/g, "-"), accountType: "general_contractor" })
    .returning();
  const names = ["Ann Alpha", "Bob Beta", "Cara Gamma", "Dan Delta"];
  for (let i = 0; i < contactCount; i++) {
    const [first, last] = names[i].split(" ");
    await db.insert(contacts).values({
      accountId: account.id,
      firstName: first,
      lastName: last,
      roleType: ["preconstruction", "estimator", "project_manager", "procurement"][i],
      influenceScore: 85 - i * 10,
    });
  }
  return account;
}

describe("swarm message distinctness", () => {
  it("computes similarity and rejects near-duplicates", () => {
    expect(messageSimilarity("hello world foo", "hello world foo")).toBe(1);
    expect(messageSimilarity("completely different text", "nothing alike here")).toBeLessThan(0.2);
    expect(() =>
      validateSwarmMessages([
        { contact_name: "A", subject: "s", body: "identical body of text for both people", day_offset: 0 },
        { contact_name: "B", subject: "s", body: "identical body of text for both people", day_offset: 1 },
      ])
    ).toThrow(/similar/);
  });
});

describe("PB06 — Company Swarm", () => {
  it("plans, drafts 4 distinct messages, and gates the swarm behind one approval", async () => {
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: (prompt: string) => {
          if (prompt.includes("Plan the swarm")) return swarmPlanFixture;
          if (prompt.includes("Draft the messages")) return swarmMessagesFixture;
          throw new Error("unexpected prompt");
        },
      })
    );
    await seedAccountWithContacts("Harvey Cleary", 4);
    const runId = await launchRun(db, {
      ploybookKey: "pb06_company_swarm",
      triggerPayload: { accountName: "Harvey Cleary" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.approvalType).toBe("swarm_outreach");
    const payload = pending?.payload as { messages: { body: string }[] };
    expect(payload.messages.length).toBeGreaterThanOrEqual(3);
    expect(payload.messages.length).toBeLessThanOrEqual(5);

    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("swarm.approved");
  });

  it("fails visibly when the model produces duplicate messages", async () => {
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: (prompt: string) => {
          if (prompt.includes("Plan the swarm")) return swarmPlanFixture;
          if (prompt.includes("Draft the messages"))
            return {
              messages: swarmMessagesFixture.messages.map((m) => ({
                ...m,
                body: "Same exact pitch for every single person at this account today.",
              })),
            };
          throw new Error("unexpected prompt");
        },
      })
    );
    await seedAccountWithContacts("Dup GC", 4);
    const runId = await launchRun(db, {
      ploybookKey: "pb06_company_swarm",
      triggerPayload: { accountName: "Dup GC" },
    });
    expect(await executeRun(db, runId)).toBe("failed");
    const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
    expect(run?.error).toContain("similar");
  });
});

describe("PB07 — ABM Account Page", () => {
  it("drafts a private page, publishes only on approval, and records engagement per view", async () => {
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: (prompt: string) =>
          prompt.includes("account research brief") ? harveyBrief : abmContentFixture,
      })
    );
    await seedAccountWithContacts("Harvey Cleary", 0);
    const runId = await launchRun(db, {
      ploybookKey: "pb07_abm_page",
      triggerPayload: { accountName: "Harvey Cleary" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    const [draft] = await db.select().from(abmPages);
    expect(draft.status).toBe("draft");
    expect(draft.publicToken).toHaveLength(32);
    // Draft is not viewable before approval
    expect(await recordPageView(db, draft.publicToken)).toBeNull();

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");

    const [published] = await db.select().from(abmPages);
    expect(published.status).toBe("published");

    // Two views → viewCount 2, interactions + events recorded (Phase 3 AC: page engagement)
    expect(await recordPageView(db, published.publicToken)).not.toBeNull();
    await recordPageView(db, published.publicToken);
    const [after] = await db.select().from(abmPages);
    expect(after.viewCount).toBe(2);
    const visits = await db.select().from(interactions);
    expect(visits.filter((i) => i.type === "website_visit")).toHaveLength(2);
    const emitted = await db.select().from(events);
    expect(emitted.filter((e) => e.eventType === "account.page_viewed")).toHaveLength(2);
  });
});

describe("PB08 — High-Intent Visitor", () => {
  it("scores pages deterministically", () => {
    const high = scoreVisitorIntent(["/pricing", "/services/monument-signs", "/portfolio"], 2);
    expect(high.score).toBeGreaterThanOrEqual(70);
    const low = scoreVisitorIntent(["/blog/some-post", "/careers"], 1);
    expect(low.score).toBe(0);
  });

  it("turns a high-intent visit into an opportunity + outreach recommendation", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb08_high_intent_visitor",
      triggerPayload: {
        companyName: "Houston Coffee Co",
        pagesVisited: ["/pricing", "/services/channel-letters", "/free-mockup"],
        visitCount: 3,
      },
    });
    expect(await executeRun(db, runId)).toBe("completed");
    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(1);
    expect(opps[0].source).toBe("website_intent");
    expect(opps[0].overallScore).toBeGreaterThanOrEqual(70);
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("account.high_intent_visit");
  });

  it("recommends monitoring (no opportunity) for low-intent visits", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb08_high_intent_visitor",
      triggerPayload: { companyName: "Random Reader LLC", pagesVisited: ["/blog/houston-signs"], visitCount: 1 },
    });
    expect(await executeRun(db, runId)).toBe("completed");
    expect(await db.select().from(opportunities)).toHaveLength(0);
  });
});
