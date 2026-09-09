import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { extname, join, basename } from "node:path";
import type { Db } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const execFileAsync = promisify(execFile);

// Bid-package document ingestion (master PRD §19):
// originals never modified; text extracted beside them; classification + relevance
// are heuristics whose results stay inspectable; extraction quality is tracked so
// low-quality docs are flagged for human review instead of silently trusted.

export type ExtractionQuality = "good" | "partial" | "none";

export interface IngestedDoc {
  documentId: string;
  filename: string;
  documentType: string;
  relevant: boolean;
  relevanceReason: string | null;
  textPath: string | null;
  textChars: number;
  quality: ExtractionQuality;
}

const RELEVANCE_FILENAME = /sign|canop|awning|monument|pylon|storefront/i;
const RELEVANCE_TEXT = /\b(sign|signage|canopy|canopies|awning|monument|pylon)\b/gi;

export function classifyByFilename(filename: string): string {
  const name = filename.toLowerCase();
  if (/rfi/.test(name)) return "reference";
  if (/add(endum)?[\s_-]?\d|^add\b|\badd \d/.test(name)) return "addendum";
  if (/invite|itb|instructions to bidders/.test(name)) return "bid_form";
  if (/proposal form|bid form/.test(name)) return "bid_form";
  if (/proposal|quote/.test(name)) return "proposal";
  if (/aia a\d|contract|agreement/.test(name)) return "contract";
  if (/^\d{5}\b|spec|division/.test(name)) return "specification";
  if (/-a\d|-s\d|-e\d|-m\d|-p\d|-f\d|plan|elevation|detail|survey|drawing|dwg|sheet|\blp-|\bli-|\btd-/.test(name))
    return "drawing";
  return "other";
}

/** Extract text from one file. Returns null text when the format can't be read. */
export async function extractText(filePath: string): Promise<{ text: string | null; quality: ExtractionQuality }> {
  const ext = extname(filePath).toLowerCase();
  try {
    if (ext === ".pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(await readFile(filePath)) });
      try {
        const result = await parser.getText();
        const text = result.text ?? "";
        // Garbled font encodings produce high symbol density — flag as partial.
        const letters = (text.match(/[a-zA-Z]/g) ?? []).length;
        const quality: ExtractionQuality =
          text.length < 50 ? "none" : letters / text.length < 0.5 ? "partial" : "good";
        return { text, quality };
      } finally {
        await parser.destroy();
      }
    }
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value, quality: result.value.length > 50 ? "good" : "none" };
    }
    if (ext === ".doc") {
      // Legacy binary .doc — macOS textutil when available, otherwise flagged for review.
      try {
        const { stdout } = await execFileAsync("textutil", ["-convert", "txt", "-stdout", filePath], {
          maxBuffer: 20 * 1024 * 1024,
        });
        return { text: stdout, quality: stdout.length > 50 ? "good" : "none" };
      } catch {
        return { text: null, quality: "none" };
      }
    }
    if ([".txt", ".md", ".csv"].includes(ext)) {
      const text = await readFile(filePath, "utf8");
      return { text, quality: "good" };
    }
    return { text: null, quality: "none" };
  } catch {
    return { text: null, quality: "none" };
  }
}

export interface IngestOptions {
  /** Where extracted text files are written. */
  textDir?: string;
  /** Skip files larger than this (huge plan sets get sheet-level handling later). */
  maxFileBytes?: number;
}

/**
 * Ingest every document in a folder for a bid: extract text, classify, flag relevance,
 * create Document rows (§9.9). Idempotent per (bidId, checksum) — re-running after an
 * addendum arrives only adds the new files.
 */
export async function ingestBidFolder(
  db: Db,
  params: { folderPath: string; bidId?: string; projectId?: string; opportunityId?: string },
  options: IngestOptions = {}
): Promise<IngestedDoc[]> {
  const textDir = options.textDir ?? ".data/doc-text";
  const maxBytes = options.maxFileBytes ?? 60 * 1024 * 1024;
  await mkdir(textDir, { recursive: true });

  const results: IngestedDoc[] = [];
  const entries = await readdir(params.folderPath, { recursive: true });
  for (const entry of entries) {
    const filePath = join(params.folderPath, entry.toString());
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) continue;
    const filename = basename(filePath);
    if (filename.startsWith(".")) continue;
    if (/ - copy/i.test(filename)) continue; // duplicate sheets ship as "- Copy" in real packages
    if (info.size > maxBytes) continue;

    const checksum = createHash("sha256")
      .update(await readFile(filePath))
      .digest("hex");
    const existing = await db.query.documents.findFirst({
      where: and(eq(documents.checksum, checksum), eq(documents.filename, filename)),
    });
    if (existing) continue;

    const documentType = classifyByFilename(filename);
    const { text, quality } = await extractText(filePath);

    let textPath: string | null = null;
    let relevant = RELEVANCE_FILENAME.test(filename);
    let relevanceReason = relevant ? "filename" : null;
    if (text) {
      const hits = text.match(RELEVANCE_TEXT)?.length ?? 0;
      if (hits >= 3 && !relevant) {
        relevant = true;
        relevanceReason = `${hits} keyword hits in text`;
      }
    }

    const [row] = await db
      .insert(documents)
      .values({
        bidId: params.bidId,
        projectId: params.projectId,
        opportunityId: params.opportunityId,
        filename,
        documentType,
        storageUrl: filePath, // original stays in place, never modified
        checksum,
        source: "bid_folder",
      })
      .returning();

    if (text) {
      textPath = join(textDir, `${row.id}.txt`);
      await writeFile(textPath, text, "utf8");
      await db.update(documents).set({ extractedTextUrl: textPath }).where(eq(documents.id, row.id));
    }

    results.push({
      documentId: row.id,
      filename,
      documentType,
      relevant,
      relevanceReason,
      textPath,
      textChars: text?.length ?? 0,
      quality,
    });
  }
  return results;
}
