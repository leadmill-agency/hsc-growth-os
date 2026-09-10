import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { setLLMClientForTests, type LLMClient } from "@/lib/ai/client";
import { setVisionForTests } from "@/lib/ai/vision";
import { bids, opportunities, evidence, activities } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// Vision fallback (2026-09-10, Wingbay permit set): a package that is ONLY
// drawings — a PDF with no text layer — must still produce an estimator brief
// by reading the pages visually, and must say so in the verification note.

const visionExtraction = {
  scope_items: [
    {
      item: "Channel letter storefront sign",
      description: "Illuminated channel letters on front elevation per sign schedule",
      fabrication: "in_house",
      sheet_or_spec_refs: ["A-201", "SG-1"],
      quantity_note: "sign schedule states (1) set",
      confidence: 0.7,
    },
  ],
  exclusions_to_state: [],
  risk_flags: [{ flag: "Electrical hookup by others unclear", source_ref: "E-101" }],
  rfis_needed: ["Confirm sign circuit by electrician"],
  addendum_changes: [],
  unknowns: ["No spec book in package"],
};

/** A real PDF with drawn shapes but NO text layer — pdf-parse extracts nothing. */
async function makeTextlessPdf(): Promise<Buffer> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawRectangle({ x: 50, y: 50, width: 500, height: 690 });
  page.drawLine({ start: { x: 50, y: 400 }, end: { x: 550, y: 400 } });
  return Buffer.from(await doc.save());
}

// The LLM client must never be hit on this path (vision handles extraction and
// there are no supplier-fab items) — fail loudly if it is.
const explodingLLM: LLMClient = {
  async generateStructured() {
    throw new Error("LLM should not be called in the vision-only path");
  },
  async generateText() {
    throw new Error("LLM should not be called in the vision-only path");
  },
};

describe("PB11 vision fallback (drawings-only package)", () => {
  let db: Db;
  let folder: string;

  beforeEach(async () => {
    resetDbForTests();
    db = await getDb();
    setLLMClientForTests(explodingLLM);
    folder = mkdtempSync(join(tmpdir(), "pb11-vision-"));
    writeFileSync(join(folder, "PermitSet.pdf"), await makeTextlessPdf());
  });

  afterEach(() => {
    setLLMClientForTests(null);
    setVisionForTests(null);
  });

  it("reads a textless drawing set visually and builds the estimator brief", async () => {
    const visionCalls: string[] = [];
    setVisionForTests(async (params) => {
      visionCalls.push(params.pdf.filename);
      return visionExtraction;
    });

    const [opp] = await db
      .insert(opportunities)
      .values({ name: "Wingbay Test", stage: "bidding" })
      .returning();
    const [bid] = await db
      .insert(bids)
      .values({ opportunityId: opp.id, status: "estimating" })
      .returning();

    const runId = await launchRun(db, {
      ploybookKey: "pb11_bid_analyzer",
      triggerType: "manual",
      triggerPayload: { folderPath: folder, bidId: bid.id, projectName: "Wingbay Test" },
      initiatedBy: "user",
    });
    const status = await executeRun(db, runId);
    expect(status).toBe("completed");
    expect(visionCalls).toEqual(["PermitSet.pdf"]);

    const briefRow = await db.query.evidence.findFirst({
      where: and(eq(evidence.entityId, bid.id), eq(evidence.fieldName, "estimator_brief")),
    });
    expect(briefRow).toBeTruthy();
    const brief = briefRow!.value as {
      inHouseItems: { item: string }[];
      scopeReadVisually: boolean;
      verificationNote: string;
    };
    expect(brief.scopeReadVisually).toBe(true);
    expect(brief.inHouseItems[0]?.item).toBe("Channel letter storefront sign");
    expect(brief.verificationNote).toContain("VISUALLY");

    const visionActivity = await db.query.activities.findFirst({
      where: and(eq(activities.entityId, bid.id), eq(activities.action, "bid.vision_scope_used")),
    });
    expect(visionActivity).toBeTruthy();
  });

  it("still writes the unreadable verdict when vision finds nothing either", async () => {
    setVisionForTests(async () => ({
      scope_items: [],
      exclusions_to_state: [],
      risk_flags: [],
      rfis_needed: [],
      addendum_changes: [],
      unknowns: [],
    }));

    const [bid] = await db.insert(bids).values({ status: "estimating" }).returning();
    const runId = await launchRun(db, {
      ploybookKey: "pb11_bid_analyzer",
      triggerType: "manual",
      triggerPayload: { folderPath: folder, bidId: bid.id, projectName: "Empty Test" },
      initiatedBy: "user",
    });
    const status = await executeRun(db, runId);
    expect(status).toBe("completed"); // skipped steps still complete the run

    const updated = await db.query.bids.findFirst({ where: eq(bids.id, bid.id) });
    expect(updated?.notes).toContain("machine-readable");
    expect(updated?.notes).toContain("visual read");
  });
});
