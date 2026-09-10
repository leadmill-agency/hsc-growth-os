import { mkdir, writeFile } from "node:fs/promises";
import { join, normalize } from "node:path";

// Bid-package upload: Jamal drags the downloaded package (as a .zip) into the
// Bids page; it's stored under STORAGE_DIR and extracted for PB11 ingestion.
// STORAGE_DIR should point at a persistent volume in production (/data on
// Railway) — originals are never modified after extraction (§19).

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;

export function storageRoot(): string {
  return process.env.DOC_STORAGE_DIR ?? ".data";
}

/**
 * Extract a zip buffer into destDir with zip-slip protection.
 * Returns the number of files extracted.
 */
export async function extractZipToDir(buffer: Buffer, destDir: string): Promise<number> {
  const { default: AdmZip } = await import("adm-zip");
  const zip = new AdmZip(buffer);
  await mkdir(destDir, { recursive: true });
  let extracted = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName;
    // zip-slip protection: refuse traversal and absolute paths
    const target = normalize(join(destDir, name));
    if (!target.startsWith(normalize(destDir))) continue;
    if (name.includes("__MACOSX") || name.split("/").some((part) => part.startsWith("."))) continue;
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, entry.getData());
    extracted++;
  }
  return extracted;
}
