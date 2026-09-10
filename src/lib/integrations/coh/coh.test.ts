import { describe, expect, it } from "vitest";
import { parseOccupancyRows, isSignageRelevant, formatCohSignal } from "./client";
import { extractZipToDir } from "@/lib/documents/upload";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Captured from a real CoH response 2026-09-10 (Certificates of Occupancy).
const SAMPLE =
  "'26078465','*VAPE CITY','15626 GALVESTON RD 77598','NC/OCC/RETAIL/1500 SQ FT./UK ANNEX/17131'," +
  "'26077637','*LA SILLA BARBER SHOP','5407 ALLENDALE RD 77017','NC/OCC/BARBER SHOP/750 SQ FT/UK CODE/#51',\n" +
  "'26078155','*GABBY\\'S BARBECUE','3101 N SHEPHERD DR 77018','OCC REPORT/RESTAURANT/1,300 SQFT'," +
  "'26076366','*NIKQA CRESCENT RIDGE','7700 MAIN ST CORE 77030','OCC REPORT/CORE ONLY/26,952 SQ FT'";

describe("CoH certificate-of-occupancy parsing", () => {
  it("parses quadruplet rows including escaped quotes", () => {
    const rows = parseOccupancyRows(SAMPLE);
    expect(rows).toHaveLength(4);
    expect(rows[0].businessName).toBe("VAPE CITY");
    expect(rows[0].address).toBe("15626 GALVESTON RD 77598");
    expect(rows[2].businessName).toBe("GABBY'S BARBECUE");
  });

  it("filters shell/core-only records and formats radar signals", () => {
    const rows = parseOccupancyRows(SAMPLE);
    const relevant = rows.filter(isSignageRelevant);
    expect(relevant.map((r) => r.businessName)).not.toContain("NIKQA CRESCENT RIDGE");
    const { signalText } = formatCohSignal(relevant[0]);
    expect(signalText).toContain("Certificate of Occupancy");
    expect(signalText).toContain("VAPE CITY");
    expect(signalText).toContain("15626 GALVESTON RD");
  });
});

describe("bid package zip extraction", () => {
  it("extracts files with zip-slip protection", async () => {
    const { default: AdmZip } = await import("adm-zip");
    const zip = new AdmZip();
    zip.addFile("DRAWINGS/A3.0 Elevations.pdf", Buffer.from("pdf-bytes"));
    zip.addFile("specs/10538 Canopies.doc", Buffer.from("doc-bytes"));
    zip.addFile("../../evil.txt", Buffer.from("nope"));
    zip.addFile("__MACOSX/junk", Buffer.from("junk"));
    const parent = mkdtempSync(join(tmpdir(), "pkgparent-"));
    const dest = join(parent, "dest");
    const extracted = await extractZipToDir(zip.toBuffer(), dest);
    // adm-zip itself sanitizes "../" on add; our guard is the backstop. The real
    // invariant: nothing is ever written OUTSIDE dest, and __MACOSX junk is skipped.
    expect(extracted).toBe(3);
    expect(readdirSync(parent).sort()).toEqual(["dest"]); // nothing escaped
    expect(readdirSync(dest).sort()).toEqual(["DRAWINGS", "evil.txt", "specs"]);
  });
});
