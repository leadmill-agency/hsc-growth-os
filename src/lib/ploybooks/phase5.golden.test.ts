import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import { processEvents } from "@/lib/events/subscriptions";
import { processDueFollowups, FOLLOWUP_CADENCE } from "./pb13-bid-followup/definition";
import { QA_CHECKLIST_ITEMS } from "./pb12-bid-qa/definition";
import { recordProposalView } from "@/lib/actions/proposals";
import {
  accounts,
  opportunities,
  bids,
  followups,
  approvals,
  proposals,
  interactions,
  events,
  evidence,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Phase 5 gate (master PRD §26): a submitted bid automatically creates a follow-up
// plan; a proposal is viewable at a private URL with view activity logged; a
// strategic deal can generate a business-case draft.

let db: Db;

const dealRoomFixture = {
  headline: "Signage package for the UH project",
  project_summary: "Scope summary grounded in the estimator brief.",
  scope_items: [{ item: "Exterior signage", detail: "Per elevations" }],
  timeline_note: "Survey → permit → fabrication → installation; dates confirmed after permit.",
  warranty_note: "5-year warranty on fabrication and workmanship.",
  exclusions: ["Primary electrical to sign location"],
  faqs: [{ q: "Can the design change?", a: "Yes, until final artwork approval." }],
  next_step: "Reply to confirm and we schedule the site survey.",
};

const businessCaseFixture = {
  title: "Why HSC for the rollout",
  current_state: "Multiple vendors, no single accountable signage partner.",
  proposed_model: "HSC as the single Houston signage partner.",
  confirmed_facts: [{ fact: "Account has 8 Houston locations", source: "account research evidence" }],
  assumptions: [{ assumption: "Per-location signage spend range", basis: "typical comparable projects" }],
  financial_ranges: [{ item: "Per-location package", low: "$15k", high: "$40k", label: "ASSUMPTION" }],
  operational_benefits: ["One accountable vendor"],
  risk_reduction: ["Permit management handled locally"],
  implementation_plan: [{ phase: "Pilot", detail: "First 2 locations" }],
  next_decision: "Approve a 2-location pilot.",
  open_questions_for_champion: ["Who owns signage budget internally?"],
};

const followupDraftFixture = { subject: "Checking on our bid", body: "Quick check — has the signage package been reviewed?" };

async function seedSubmittedBid() {
  const [account] = await db
    .insert(accounts)
    .values({ name: "C.A. Walker", slug: "ca-walker", accountType: "general_contractor" })
    .returning();
  const [opp] = await db
    .insert(opportunities)
    .values({ name: "RTG Baytown bid", accountId: account.id, stage: "estimating" })
    .returning();
  const [bid] = await db
    .insert(bids)
    .values({ opportunityId: opp.id, status: "estimating", dueAt: new Date(Date.now() + 5 * 86400000) })
    .returning();
  return { account, opp, bid };
}

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
});

afterEach(() => {
  setLLMClientForTests(null);
});

describe("PB13 — automatic follow-up plan from bid.submitted", () => {
  it("PB12 submission → event subscription launches PB13 → Day 2/7/14/30 plan exists", async () => {
    const { bid } = await seedSubmittedBid();
    // Submit via PB12 (real path)
    const runId = await launchRun(db, {
      ploybookKey: "pb12_bid_qa",
      triggerPayload: { bidId: bid.id, checkedItems: [...QA_CHECKLIST_ITEMS] },
    });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    await resolveApproval(db, pending!.id, "approved");

    // The scheduler's event pass picks up bid.submitted and launches PB13
    const handled = await processEvents(db);
    expect(handled).toBeGreaterThanOrEqual(1);

    const plan = await db.query.followups.findMany({ where: eq(followups.bidId, bid.id) });
    expect(plan).toHaveLength(FOLLOWUP_CADENCE.length);
    const kinds = plan.map((f) => f.kind).sort();
    expect(kinds).toContain("receipt_confirmation");
    expect(kinds).toContain("award_check");

    // Cadence offsets measured from submission
    const submitted = (await db.query.bids.findFirst({ where: eq(bids.id, bid.id) }))!.submittedAt!;
    const receipt = plan.find((f) => f.kind === "receipt_confirmation")!;
    expect(Math.round((receipt.dueAt.getTime() - submitted.getTime()) / 86400000)).toBe(2);

    // Re-processing events must not duplicate the plan
    await processEvents(db);
    expect(await db.query.followups.findMany({ where: eq(followups.bidId, bid.id) })).toHaveLength(
      FOLLOWUP_CADENCE.length
    );
  });

  it("drafts due follow-ups into the approvals inbox, and cancels them once the bid outcome is known", async () => {
    setLLMClientForTests(new FixtureLLMClient({ structured: () => followupDraftFixture }));
    const { bid } = await seedSubmittedBid();
    await db.update(bids).set({ status: "submitted", submittedAt: new Date() }).where(eq(bids.id, bid.id));
    const [due] = await db
      .insert(followups)
      .values({ bidId: bid.id, opportunityId: bid.opportunityId, kind: "status_followup", dueAt: new Date(Date.now() - 1000) })
      .returning();
    const [future] = await db
      .insert(followups)
      .values({ bidId: bid.id, opportunityId: bid.opportunityId, kind: "award_check", dueAt: new Date(Date.now() + 86400000) })
      .returning();

    expect(await processDueFollowups(db)).toBe(1);
    const drafted = await db.query.followups.findFirst({ where: eq(followups.id, due.id) });
    expect(drafted?.status).toBe("drafted");
    expect(drafted?.approvalId).not.toBeNull();
    const untouched = await db.query.followups.findFirst({ where: eq(followups.id, future.id) });
    expect(untouched?.status).toBe("pending");

    // Outcome known → remaining follow-ups cancel instead of chasing
    await db.update(bids).set({ status: "won" }).where(eq(bids.id, bid.id));
    await db.update(followups).set({ dueAt: new Date(Date.now() - 1000) }).where(eq(followups.id, future.id));
    await processDueFollowups(db);
    const cancelled = await db.query.followups.findFirst({ where: eq(followups.id, future.id) });
    expect(cancelled?.status).toBe("cancelled");
  });
});

describe("PB14 — Proposal Deal Room", () => {
  it("composes a priced-by-human deal room, publishes on approval, tracks views + high engagement", async () => {
    setLLMClientForTests(new FixtureLLMClient({ structured: () => dealRoomFixture }));
    const { opp } = await seedSubmittedBid();
    const runId = await launchRun(db, {
      ploybookKey: "pb14_deal_room",
      triggerPayload: { opportunityId: opp.id },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    const [draft] = await db.select().from(proposals);
    expect(draft.status).toBe("draft");
    expect(draft.total).toBeNull(); // pricing is never model-generated
    expect(await recordProposalView(db, draft.publicToken!)).toBeNull(); // private until published

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");

    // 3 views → viewCount 3, interactions logged, high-engagement event fires once
    await recordProposalView(db, draft.publicToken!);
    await recordProposalView(db, draft.publicToken!);
    await recordProposalView(db, draft.publicToken!);
    const [after] = await db.select().from(proposals);
    expect(after.viewCount).toBe(3);
    const views = await db.select().from(interactions);
    expect(views.filter((i) => i.type === "proposal_view")).toHaveLength(3);
    const emitted = await db.select().from(events);
    expect(emitted.filter((e) => e.eventType === "proposal.high_engagement")).toHaveLength(1);
  });
});

describe("PB15 — Business Case", () => {
  it("drafts a business case with confirmed facts strictly separated from labeled assumptions", async () => {
    setLLMClientForTests(new FixtureLLMClient({ structured: () => businessCaseFixture }));
    const { opp } = await seedSubmittedBid();
    const runId = await launchRun(db, {
      ploybookKey: "pb15_business_case",
      triggerPayload: { opportunityId: opp.id, context: "Champion needs internal justification." },
    });
    expect(await executeRun(db, runId)).toBe("completed");

    const rows = await db.query.evidence.findMany({
      where: eq(evidence.fieldName, "business_case"),
    });
    expect(rows).toHaveLength(1);
    const bc = rows[0].value as typeof businessCaseFixture;
    expect(bc.confirmed_facts[0].source).toBeTruthy();
    expect(bc.financial_ranges.every((r) => r.label === "ASSUMPTION")).toBe(true);
    expect(rows[0].verificationStatus).toBe("inferred"); // a draft is never a fact
  });
});
