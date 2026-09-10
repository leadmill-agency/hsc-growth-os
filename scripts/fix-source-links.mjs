// One-off data repair (2026-09-10): existing rows carry TDLR links in the old
// /TABS/Search/Project/{id} form ("Project Not Found") and CoH links to the
// portal home page (no per-permit deep link exists). Rewrite the former to the
// working /TABS/Search/Details/{id} route, and null the latter. Idempotent.
//   node scripts/fix-source-links.mjs
import postgres from "postgres";
import { readFileSync } from "fs";

const url = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();
const sql = postgres(url, { prepare: false });

const OLD = "https://www.tdlr.texas.gov/TABS/Search/Project/";
const NEW = "https://www.tdlr.texas.gov/TABS/Search/Details/";
const COH = "%online_permit.htm%";

const o1 = await sql`update opportunities set source_detail = replace(source_detail, ${OLD}, ${NEW}) where source_detail like ${OLD + "%"} returning id`;
const o2 = await sql`update opportunities set source_detail = null where source_detail like ${COH} returning id`;
const e1 = await sql`update evidence set source_url = replace(source_url, ${OLD}, ${NEW}) where source_url like ${OLD + "%"} returning id`;
const e2 = await sql`update evidence set source_url = null where source_url like ${COH} returning id`;
console.log(`opportunities: ${o1.length} tdlr links fixed, ${o2.length} coh links removed`);
console.log(`evidence: ${e1.length} tdlr links fixed, ${e2.length} coh links removed`);
await sql.end();
