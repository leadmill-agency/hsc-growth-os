import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import {
  FixtureResearchProvider,
  setResearchProviderForTests,
} from "@/lib/integrations/research/provider";
import {
  harveySignalText,
  harveySignalParse,
  harveyResearchText,
  harveyBrief,
  harveyStakeholderPlan,
  harveyOutreachDraft,
} from "@/fixtures/harvey";
import { accounts, contacts, opportunities, approvals, evidence, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// The Harvey Golden Path (master PRD §36): signal → radar → pursue → research →
// score → stakeholder map → readiness → outreach draft → approval → activity.
// Runs entirely on fixtures — zero live connectors (§33.12).

let db: Db;

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setResearchProviderForTests(
    new FixtureResearchProvider(() => ({
      text: harveyResearchText,
      sources: [{ url: "https://www.harveycleary.com", title: "Harvey Cleary" }],
    }))
  );
  setLLMClientForTests(
    new FixtureLLMClient({
      structured: (prompt: string) => {
        if (prompt.includes("SIGNAL:")) return harveySignalParse;
        if (prompt.includes("account research brief")) return harveyBrief;
        if (prompt.includes("Build the stakeholder map")) return harveyStakeholderPlan;
        if (prompt.includes("Draft the bid-access email")) return harveyOutreachDraft;
        throw new Error(`No fixture for prompt: ${prompt.slice(0, 80)}`);
      },
    })
  );
});

afterEach(() => {
  setLLMClientForTests(null);
  setResearchProviderForTests(null);
});

describe("Harvey Golden Path", () => {
  it("PB05 turns the raw signal into a scored suggested opportunity", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerPayload: { signalText: harveySignalText, sourceUrl: "https://bids.example/uh" },
    });
    expect(await executeRun(db, runId)).toBe("completed");

    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(1);
    expect(opps[0].stage).toBe("discovered");
    expect(opps[0].overallScore).toBe(84);
    expect(opps[0].nextAction).toContain("pb01_gc_pursuit");

    // Origin signal preserved as verified evidence
    const ev = await db.select().from(evidence);
    expect(ev.some((e) => e.fieldName === "origin_signal")).toBe(true);

    // Re-running the same signal dedupes instead of duplicating
    const rerunId = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerPayload: { signalText: harveySignalText },
    });
    await executeRun(db, rerunId);
    expect(await db.select().from(opportunities)).toHaveLength(1);
    expect(await db.select().from(accounts)).toHaveLength(1);
  });

  it("PB01 runs the full pursuit to approval and completion without duplicating entities", async () => {
    // Radar first (as in the real flow), then Pursue launches PB01 on the same entities.
    const radarRun = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerPayload: { signalText: harveySignalText },
    });
    await executeRun(db, radarRun);

    const runId = await launchRun(db, {
      ploybookKey: "pb01_gc_pursuit",
      triggerPayload: {
        gcName: "Harvey Cleary",
        projectName: "UH Engineering Building",
        city: "Houston",
        tradeScope: "signage/wayfinding",
        sourceUrl: "https://bids.example/uh",
      },
      initiatedBy: "rameel",
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    // AC1: one deduplicated account/project/opportunity (radar already created them)
    expect(await db.select().from(accounts)).toHaveLength(1);
    expect(await db.select().from(opportunities)).toHaveLength(1);

    const [opp] = await db.select().from(opportunities);
    expect(opp.fitScore).toBeGreaterThan(0);

    // AC3: stakeholder contacts created; missing roles surfaced in the approval summary
    const contactRows = await db.select().from(contacts);
    expect(contactRows).toHaveLength(1);
    expect(contactRows[0].roleType).toBe("preconstruction");
    expect(contactRows[0].verifiedAt).toBeNull(); // research contacts are unverified until checked

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.approvalType).toBe("send_outreach");
    expect(pending?.summary).toContain("estimator");

    // AC4: draft is short and stored in the approval payload
    const payload = pending?.payload as { draft: { body: string; word_count: number } };
    expect(payload.draft.word_count).toBeLessThanOrEqual(150);
    expect(payload.draft.body).not.toMatch(/instant quote|free quote today/i);

    // Approve → run completes, opportunity moves to pursuing, event emitted
    expect(await resolveApproval(db, pending!.id, "approved", { resolvedBy: "rameel" })).toBe(
      "completed"
    );
    const [after] = await db.select().from(opportunities);
    expect(after.stage).toBe("pursuing");

    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("outreach.approved");
  });

  it("PB05 anchors a no-company permit signal on the project instead of dropping or fabricating", async () => {
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: () => ({
          ...harveySignalParse,
          company_name: null,
          company_type: "unknown",
          project_name: "Office Warehouse at Rankin",
          estimated_relevance_score: 75,
        }),
      })
    );
    const runId = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerPayload: { signalText: "TDLR TABS filing ...", source: "tdlr" },
    });
    expect(await executeRun(db, runId)).toBe("completed");
    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(1);
    expect(opps[0].accountId).toBeNull();
    expect(opps[0].name).toContain("owner unknown");
    expect(opps[0].nextAction).toContain("Identify owner/GC");
    expect(await db.select().from(accounts)).toHaveLength(0); // nothing fabricated
  });

  it("PB01 records a rejection without losing the research", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb01_gc_pursuit",
      triggerPayload: { gcName: "Harvey Cleary", projectName: "UH Engineering Building" },
    });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(await resolveApproval(db, pending!.id, "rejected")).toBe("completed");
    const [opp] = await db.select().from(opportunities);
    expect(opp.stage).toBe("qualified"); // held, not discarded
    expect(await db.select().from(contacts)).toHaveLength(1); // research preserved
  });
});
