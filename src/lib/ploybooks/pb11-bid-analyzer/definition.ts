import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { PloybookDefinition } from "../types";
import { getLLMClient } from "@/lib/ai/client";
import { ingestBidFolder, type IngestedDoc } from "@/lib/documents/ingest";
import { saveEvidence } from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// PB11 — Bid Package Analyzer: read the package, produce the estimator brief for Jamal.
// Trigger payload: { folderPath, bidId?, projectId?, opportunityId?, projectName? }
// Design driven by Jamal's real workflow (2026-09-09): the critical path is SUPPLIER
// pricing for awnings/canopies/backlit (HSC doesn't fabricate those in-house) — so this
// ploybook splits scope by fabrication path and drafts supplier RFQs on day 1, before
// the takeoff is finished. Quantities are AI-extracted → always confidence-labeled and
// estimator-verified (PB11 PRD hard rule).

const scopeExtractionSchema = z.object({
  scope_items: z.array(
    z.object({
      item: z.string(),
      description: z.string(),
      fabrication: z.enum(["in_house", "supplier_fab", "unclear"]),
      sheet_or_spec_refs: z.array(z.string()),
      quantity_note: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    })
  ),
  exclusions_to_state: z.array(z.string()),
  risk_flags: z.array(z.object({ flag: z.string(), source_ref: z.string().nullable() })),
  rfis_needed: z.array(z.string()),
  addendum_changes: z.array(z.string()),
  unknowns: z.array(z.string()),
});

type ScopeExtraction = z.infer<typeof scopeExtractionSchema>;

const rfqDraftSchema = z.object({
  rfqs: z.array(
    z.object({
      supplier_category: z.string(), // e.g. "awning/canopy fabricator"
      subject: z.string(),
      body: z.string(),
      items_covered: z.array(z.string()),
      attachments_needed: z.array(z.string()), // which sheets/specs to attach
    })
  ),
});

const MAX_ANALYSIS_CHARS = 60_000;
const MAX_RELEVANT_DOCS = 12;

export const pb11BidAnalyzer: PloybookDefinition = {
  key: "pb11_bid_analyzer",
  name: "PB11 — Bid Package Analyzer",
  description:
    "Ingests a bid-package folder, finds signage/awning/canopy-relevant sheets and specs, extracts scope split by fabrication path (in-house vs supplier), flags risks/RFIs, produces the estimator brief, and drafts day-1 supplier RFQs.",
  version: "1.0",
  triggerTypes: ["manual", "ploybook"],
  steps: [
    {
      key: "ingest_documents",
      name: "Ingest and classify documents",
      async run(ctx) {
        const p = ctx.triggerPayload as {
          folderPath?: string;
          bidId?: string;
          projectId?: string;
          opportunityId?: string;
        };
        if (!p.folderPath) throw new Error("folderPath is required");
        const docs = await ingestBidFolder(ctx.db, {
          folderPath: p.folderPath,
          bidId: p.bidId,
          projectId: p.projectId,
          opportunityId: p.opportunityId,
        });
        const byType: Record<string, number> = {};
        for (const doc of docs) byType[doc.documentType] = (byType[doc.documentType] ?? 0) + 1;
        const lowQuality = docs.filter((d) => d.quality !== "good").map((d) => d.filename);
        return {
          kind: "completed",
          outputs: {
            totalIngested: docs.length,
            byType,
            relevant: docs.filter((d) => d.relevant),
            lowQualityFiles: lowQuality.slice(0, 30),
          },
        };
      },
    },
    {
      key: "extract_scope",
      name: "Extract signage/awning scope",
      async run(ctx) {
        const ingested = ctx.priorOutputs["ingest_documents"];
        const relevant = (ingested.relevant as IngestedDoc[]).slice(0, MAX_RELEVANT_DOCS);
        if (relevant.length === 0) {
          return { kind: "skipped", reason: "No signage/awning-relevant documents found" };
        }
        let corpus = "";
        for (const doc of relevant) {
          if (!doc.textPath) {
            corpus += `\n\n===== ${doc.filename} (${doc.documentType}) — NO TEXT EXTRACTED (needs human review) =====\n`;
            continue;
          }
          const text = await readFile(doc.textPath, "utf8").catch(() => "");
          const budget = Math.floor(MAX_ANALYSIS_CHARS / relevant.length);
          corpus += `\n\n===== ${doc.filename} (${doc.documentType}) =====\n${text.slice(0, budget)}`;
        }
        const p = ctx.triggerPayload as { projectName?: string };
        const llm = getLLMClient();
        const extraction = await llm.generateStructured({
          system:
            "You analyze construction bid documents for Houston Sign Crafters. Extract ONLY " +
            "signage, awning, and canopy scope actually present in the documents, with the file/" +
            "sheet/spec-section reference for every item. fabrication: in_house for channel " +
            "letters, cabinets, monuments, vinyl, interior signage; supplier_fab for awnings, " +
            "canopies, and backlit signs (HSC buys those); unclear otherwise. Quantities only " +
            "when the text states them — put them in quantity_note with a confidence reflecting " +
            "how explicit the source is; NEVER infer quantities. Risk flags to watch: electrical " +
            "hookup, engineering/delegated design, bonding, liquidated damages, retainage, " +
            "certified payroll, unusual warranty, night work, owner-furnished material, field " +
            "verification, structural coordination. Missing information goes in unknowns.",
          prompt:
            `Project: ${p.projectName ?? "unknown"}\n\nDOCUMENT EXCERPTS:${corpus}\n\n` +
            `Extract the signage/awning/canopy scope.`,
          schema: scopeExtractionSchema,
          effort: "high",
          maxTokens: 16000,
        });
        return { kind: "completed", outputs: { extraction } };
      },
    },
    {
      key: "estimator_brief",
      name: "Assemble estimator brief",
      async run(ctx) {
        const p = ctx.triggerPayload as { bidId?: string; projectName?: string };
        const extractionStep = ctx.priorOutputs["extract_scope"];
        if (!extractionStep) return { kind: "skipped", reason: "No scope extracted" };
        const extraction = extractionStep.extraction as ScopeExtraction;
        const ingested = ctx.priorOutputs["ingest_documents"];
        const brief = {
          project: p.projectName ?? "unknown",
          documentsIngested: ingested.totalIngested,
          inHouseItems: extraction.scope_items.filter((i) => i.fabrication === "in_house"),
          supplierFabItems: extraction.scope_items.filter((i) => i.fabrication === "supplier_fab"),
          unclearItems: extraction.scope_items.filter((i) => i.fabrication === "unclear"),
          exclusionsToState: extraction.exclusions_to_state,
          riskFlags: extraction.risk_flags,
          rfisNeeded: extraction.rfis_needed,
          addendumChanges: extraction.addendum_changes,
          unknowns: extraction.unknowns,
          lowQualityFiles: ingested.lowQualityFiles,
          verificationNote:
            "All quantities are AI-extracted and confidence-labeled — estimator must verify every quantity and price against the actual sheets before bidding.",
        };
        if (p.bidId) {
          await saveEvidence(ctx.db, {
            entityType: "bid",
            entityId: p.bidId,
            fieldName: "estimator_brief",
            value: brief,
            sourceName: "pb11_analyzer",
            verificationStatus: "inferred",
          });
          await logActivity(ctx.db, {
            entityType: "bid",
            entityId: p.bidId,
            action: "bid.brief_ready",
            detail: `${brief.inHouseItems.length} in-house, ${brief.supplierFabItems.length} supplier-fab, ${brief.riskFlags.length} risk flags`,
            ploybookRunId: ctx.runId,
          });
        }
        return { kind: "completed", outputs: { brief } };
      },
    },
    {
      key: "supplier_rfqs",
      name: "Draft day-1 supplier RFQs",
      async run(ctx) {
        if (ctx.approvalResolution) {
          return { kind: "completed", outputs: { decision: ctx.approvalResolution.status } };
        }
        const briefStep = ctx.priorOutputs["estimator_brief"];
        if (!briefStep) return { kind: "skipped", reason: "No brief" };
        const brief = briefStep.brief as { supplierFabItems: unknown[]; project: string };
        if (brief.supplierFabItems.length === 0) {
          return { kind: "skipped", reason: "No supplier-fab items — nothing to RFQ" };
        }
        const p = ctx.triggerPayload as { bidDueAt?: string };
        const llm = getLLMClient();
        const drafted = await llm.generateStructured({
          system:
            "Draft supplier RFQ emails for Houston Sign Crafters. Supplier pricing lag is the #1 " +
            "bid-cycle bottleneck, so these go out on DAY 1. One RFQ per supplier category. " +
            "Each: short, specific, lists items with sheet/spec references, and lists which " +
            "sheets to attach. If a bid due date is provided below, ask for pricing 3-5 days " +
            "before it; if NO due date is provided, ask for the supplier's soonest turnaround — " +
            "NEVER invent dates. No invented specs — reference the documents.",
          prompt:
            `Project: ${brief.project}\nBid due date: ${p.bidDueAt ?? "NOT PROVIDED — do not invent one"}\n\n` +
            `Supplier-fab items:\n${JSON.stringify(brief.supplierFabItems, null, 1)}\n\nDraft the RFQs.`,
          schema: rfqDraftSchema,
          effort: "medium",
        });
        return {
          kind: "needs_approval",
          approval: {
            approvalType: "send_supplier_rfqs",
            title: `Send ${drafted.rfqs.length} supplier RFQ(s): ${brief.project}`,
            summary:
              "Day-1 RFQs for supplier-fabricated items (awnings/canopies/backlit). Jamal reviews, picks suppliers, attaches the listed sheets. Sending is a separate guarded action.",
            proposedAction: "Approve to mark RFQs ready for Jamal to send.",
            payload: { rfqs: drafted.rfqs },
          },
        };
      },
    },
    {
      key: "finalize",
      name: "Finalize analysis",
      async run(ctx) {
        const p = ctx.triggerPayload as { bidId?: string; opportunityId?: string };
        await emitEvent(ctx.db, {
          eventType: "bid.ready_for_estimating",
          bidId: p.bidId,
          opportunityId: p.opportunityId,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { done: true } };
      },
    },
  ],
};
