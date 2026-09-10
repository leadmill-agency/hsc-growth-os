import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval } from "@/lib/ploybooks/runner";
import { FixtureLLMClient, setLLMClientForTests } from "@/lib/ai/client";
import { ingestBidFolder, classifyByFilename } from "@/lib/documents/ingest";
import { accounts, bids, documents, approvals, events, opportunities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Phase 4 gate (master PRD §26): using a real HSC bid package —
// ingest invitation → create bid → extract due date → identify relevant docs →
// summarize scope → identify risks → estimator brief → QA checklist.
// Fixtures are REAL files from the Rooms To Go Baytown package (C.A. Walker GC).

const FIXTURE_FOLDER = "src/fixtures/rtg-package";

const rtgInviteText = `BID INVITE
C.A. Walker Construction | Estimating Dept. | 1543 Silber Road, Houston, Texas | (713) 956-7070
PROJECT: Rooms To Go - Baytown 4815 East Fwy
BID DUE: 08/10/2026 at 2:00 PM
SCOPE: Ground up construction of a new Rooms To Go retail showroom in Baytown, Texas.
EMAIL BID TO: bids@cawalker.net`;

const rtgInviteParse = {
  gc_name: "C.A. Walker Construction",
  project_name: "Rooms To Go - Baytown",
  project_address: "4815 East Fwy",
  city: "Baytown",
  scope_summary: "Ground-up Rooms To Go retail showroom.",
  bid_due: "2026-08-10T14:00:00-05:00",
  submission_method: "bids@cawalker.net",
  signage_awning_relevance: "likely",
  service_area: "houston_metro",
  supplier_fab_items_expected: ["wall hung canopies"],
  unknowns: ["signage package award structure"],
};

const rtgScopeExtraction = {
  scope_items: [
    {
      item: "Wall hung canopies",
      description: "Prefinished aluminum wall-hung canopies per Division 10 spec 10538",
      fabrication: "supplier_fab",
      sheet_or_spec_refs: ["10538 Wall Hung Canopies.doc"],
      quantity_note: null,
      confidence: 0.8,
    },
    {
      item: "Building identity signage",
      description: "Exterior storefront signage per elevations",
      fabrication: "in_house",
      sheet_or_spec_refs: ["00dwg list.pdf"],
      quantity_note: "quantities not stated in reviewed excerpts",
      confidence: 0.4,
    },
  ],
  exclusions_to_state: ["primary electrical to sign location"],
  risk_flags: [{ flag: "structural coordination for canopy attachments", source_ref: "10538" }],
  rfis_needed: ["Confirm canopy finish color vs AAMA 2605 requirement"],
  addendum_changes: [],
  unknowns: ["canopy linear footage"],
};

const rtgRfqDraft = {
  rfqs: [
    {
      supplier_category: "awning/canopy fabricator",
      subject: "RFQ — wall hung canopies, Rooms To Go Baytown (bid due 8/10)",
      body: "We are bidding the Rooms To Go Baytown showroom and need pricing on prefinished wall-hung canopies per spec 10538. Please quote by 8/5 so we can meet the GC's 8/10 deadline.",
      items_covered: ["Wall hung canopies"],
      attachments_needed: ["10538 Wall Hung Canopies.doc", "canopy sections A5.2"],
    },
  ],
};

let db: Db;

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
});

afterEach(() => {
  setLLMClientForTests(null);
});

describe("document ingestion", () => {
  it("classifies real filenames correctly", () => {
    expect(classifyByFilename("20260810-2 - Rooms To Go - Baytown - Bid Invite.docx")).toBe("bid_form");
    expect(classifyByFilename("10538 Wall Hung Canopies.doc")).toBe("specification");
    expect(classifyByFilename("00dwg list.pdf")).toBe("drawing");
    expect(classifyByFilename("5029-A52-Canopy Sections-A5.2.pdf")).toBe("drawing");
    expect(classifyByFilename("Add 1 Narrative.pdf")).toBe("addendum");
    expect(classifyByFilename("RFI 002 - Response.pdf")).toBe("reference");
    expect(classifyByFilename("00301 Proposal Form.doc")).toBe("bid_form");
  });

  it("ingests the real fixture folder: extracts text, flags relevance, dedupes on re-run", async () => {
    const textDir = mkdtempSync(join(tmpdir(), "doc-text-"));
    const docs = await ingestBidFolder(db, { folderPath: FIXTURE_FOLDER }, { textDir });
    expect(docs).toHaveLength(3);

    const canopySpec = docs.find((d) => d.filename.includes("Canopies"));
    expect(canopySpec?.relevant).toBe(true); // filename match
    expect(canopySpec?.documentType).toBe("specification");

    const pdf = docs.find((d) => d.filename.endsWith(".pdf"));
    expect(pdf?.textChars).toBeGreaterThan(100); // real PDF text extraction works

    const invite = docs.find((d) => d.filename.endsWith(".docx"));
    expect(invite?.quality).toBe("good"); // mammoth extraction

    // Idempotent: second ingest adds nothing
    const again = await ingestBidFolder(db, { folderPath: FIXTURE_FOLDER }, { textDir });
    expect(again).toHaveLength(0);
    expect(await db.select().from(documents)).toHaveLength(3);
  });
});

describe("PB10 — Incoming Bid (real RTG invite)", () => {
  it("parses the invite, creates tracked bid with due dates, gates BID/REVIEW, activates on approval", async () => {
    setLLMClientForTests(new FixtureLLMClient({ structured: () => rtgInviteParse }));
    const runId = await launchRun(db, {
      ploybookKey: "pb10_incoming_bid",
      triggerPayload: { inviteText: rtgInviteText, source: "email" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    const [gc] = await db.select().from(accounts);
    expect(gc.name).toBe("C.A. Walker Construction");
    const [bid] = await db.select().from(bids);
    expect(bid.dueAt).not.toBeNull();
    expect(bid.internalDueAt!.getTime()).toBeLessThan(bid.dueAt!.getTime()); // internal buffer
    expect(bid.notes).toContain("bids@cawalker.net");
    expect(bid.notes).toContain("Jamal");

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.title).toContain("REVIEW"); // "likely" relevance → REVIEW
    expect(pending?.summary).toContain("wall hung canopies");

    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");
    const [after] = await db.select().from(bids);
    expect(after.status).toBe("estimating");
  });

  it("marks the bid passed on rejection", async () => {
    setLLMClientForTests(new FixtureLLMClient({ structured: () => rtgInviteParse }));
    const runId = await launchRun(db, {
      ploybookKey: "pb10_incoming_bid",
      triggerPayload: { inviteText: rtgInviteText },
    });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    await resolveApproval(db, pending!.id, "rejected");
    const [bid] = await db.select().from(bids);
    expect(bid.status).toBe("passed");
  });
});

describe("PB11 — Bid Package Analyzer (real fixture files)", () => {
  it("ingests, extracts split scope, assembles the brief, and drafts day-1 supplier RFQs behind approval", async () => {
    setLLMClientForTests(
      new FixtureLLMClient({
        structured: (prompt: string) => {
          if (prompt.includes("Extract the signage")) return rtgScopeExtraction;
          if (prompt.includes("Draft the RFQs")) return rtgRfqDraft;
          throw new Error("unexpected prompt");
        },
      })
    );
    const runId = await launchRun(db, {
      ploybookKey: "pb11_bid_analyzer",
      triggerPayload: { folderPath: FIXTURE_FOLDER, projectName: "Rooms To Go - Baytown" },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.approvalType).toBe("send_supplier_rfqs");
    const payload = pending?.payload as { rfqs: { supplier_category: string }[] };
    expect(payload.rfqs[0].supplier_category).toContain("canopy");

    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("bid.ready_for_estimating");
  });
});

describe("PB12 — Bid QA + Submission", () => {
  async function seedBid(dueInDays: number) {
    const [opp] = await db.insert(opportunities).values({ name: "RTG bid", stage: "estimating" }).returning();
    const [bid] = await db
      .insert(bids)
      .values({
        opportunityId: opp.id,
        status: "estimating",
        dueAt: new Date(Date.now() + dueInDays * 24 * 3600 * 1000),
      })
      .returning();
    return bid;
  }

  it("reports NOT READY with blockers when items are open", async () => {
    const bid = await seedBid(5);
    const runId = await launchRun(db, {
      ploybookKey: "pb12_bid_qa",
      triggerPayload: { bidId: bid.id, checkedItems: ["base bid amount complete"] },
    });
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.title).toContain("NOT READY");
    expect(pending?.summary).toContain("supplier quotes received");
  });

  it("reports READY when all items check out, and records the human submission on approval", async () => {
    const bid = await seedBid(5);
    const { QA_CHECKLIST_ITEMS } = await import("./pb12-bid-qa/definition");
    const runId = await launchRun(db, {
      ploybookKey: "pb12_bid_qa",
      triggerPayload: { bidId: bid.id, checkedItems: [...QA_CHECKLIST_ITEMS] },
    });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.title).toContain("READY");

    expect(await resolveApproval(db, pending!.id, "approved")).toBe("completed");
    const [after] = await db.select().from(bids);
    expect(after.status).toBe("submitted");
    expect(after.submittedAt).not.toBeNull();
    const emitted = await db.select().from(events);
    expect(emitted.map((e) => e.eventType)).toContain("bid.submitted"); // PB13's trigger
  });

  it("flags a passed due date as a blocker", async () => {
    const bid = await seedBid(-1);
    const { QA_CHECKLIST_ITEMS } = await import("./pb12-bid-qa/definition");
    const runId = await launchRun(db, {
      ploybookKey: "pb12_bid_qa",
      triggerPayload: { bidId: bid.id, checkedItems: [...QA_CHECKLIST_ITEMS] },
    });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.summary).toContain("DUE DATE HAS PASSED");
  });
});
