// Manual "run this week's SEO + content scan now" — same logic the Monday
// scheduler tick runs: pick the next uncovered city × product combo (PB16) and
// the next unwritten buyer question (PB17), draft both behind publish approvals.
// Week-marked, so the scheduled tick won't double-run it.
//   npx tsx scripts/run-seo-scan-now.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const db = await getDb();
  const { runWeeklySeoScan } = await import("../src/lib/integrations/seo-scan/weekly");
  // force: draft the next targets even if something already ran this week —
  // running by hand means you want fresh drafts now (targets still dedupe).
  for (const line of await runWeeklySeoScan(db, { force: true })) console.log(line);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
