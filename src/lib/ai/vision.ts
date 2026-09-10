import { z } from "zod";

// Vision over PDF documents (drawings, scanned plan sets) via the OpenAI
// Responses API file input — the model SEES the pages, so sign schedules and
// elevation callouts on drawing sheets are readable even with no text layer.
// Same discipline as the rest of the AI layer: structured output, zod-validated,
// test override so no test ever makes a live call (§33.6-7, §34).

export interface VisionPdfParams<S extends z.ZodType> {
  /** Instructions + question. Sent alongside the file in one user turn. */
  prompt: string;
  pdf: { filename: string; data: Buffer };
  schema: S;
}

type VisionOverride = (params: VisionPdfParams<z.ZodType>) => Promise<unknown>;
let testOverride: VisionOverride | null = null;

/** Tests inject a fixture extractor; pass null to restore the live client. */
export function setVisionForTests(fn: VisionOverride | null) {
  testOverride = fn;
}

// The Responses API caps file inputs (100 pages / ~32MB); callers chunk with
// splitPdfForVision() before calling. Kept slightly under the caps for safety.
export const VISION_MAX_PAGES_PER_CALL = 80;
export const VISION_MAX_BYTES_PER_CALL = 28 * 1024 * 1024;

export async function generateStructuredFromPdf<S extends z.ZodType>(
  params: VisionPdfParams<S>
): Promise<z.infer<S>> {
  if (testOverride) return params.schema.parse(await testOverride(params));
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("PDF vision requires OPENAI_API_KEY (tests: setVisionForTests())");
  }
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI();
  const jsonSchema = z.toJSONSchema(params.schema);
  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL ?? "gpt-5-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: params.pdf.filename,
            file_data: `data:application/pdf;base64,${params.pdf.data.toString("base64")}`,
          },
          { type: "input_text", text: params.prompt },
        ],
      },
    ],
    text: {
      format: { type: "json_schema", name: "structured_output", strict: false, schema: jsonSchema },
    },
  });
  const content = response.output_text;
  if (!content) throw new Error("OpenAI returned no content for PDF vision request");
  return params.schema.parse(JSON.parse(content));
}

/**
 * Split a PDF into chunks the vision API accepts. Returns the original buffer
 * untouched when it already fits. Page labels in prompts should reference the
 * chunk's pageOffset so sheet citations stay meaningful.
 */
export async function splitPdfForVision(
  data: Buffer,
  opts?: { maxPages?: number; maxBytes?: number }
): Promise<{ data: Buffer; pageOffset: number; pageCount: number }[]> {
  const maxPages = opts?.maxPages ?? VISION_MAX_PAGES_PER_CALL;
  const maxBytes = opts?.maxBytes ?? VISION_MAX_BYTES_PER_CALL;
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(data, { ignoreEncryption: true });
  const total = source.getPageCount();
  if (total <= maxPages && data.byteLength <= maxBytes) {
    return [{ data, pageOffset: 0, pageCount: total }];
  }
  // Size-aware page budget: scale down when the file is heavy per page (scans).
  const bytesPerPage = data.byteLength / Math.max(total, 1);
  const pagesPerChunk = Math.max(1, Math.min(maxPages, Math.floor(maxBytes / bytesPerPage)));
  const chunks: { data: Buffer; pageOffset: number; pageCount: number }[] = [];
  for (let start = 0; start < total; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, total);
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(
      source,
      Array.from({ length: end - start }, (_, i) => start + i)
    );
    for (const page of pages) doc.addPage(page);
    chunks.push({
      data: Buffer.from(await doc.save()),
      pageOffset: start,
      pageCount: end - start,
    });
  }
  return chunks;
}
