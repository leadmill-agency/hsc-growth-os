// CLI wrapper around the shared TDLR runner.
//   npm run radar:tdlr -- [sinceDays] [minCost] [maxResults]
import { readFileSync } from "node:fs";

async function main() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // rely on process env
  }
  const [sinceDays, minCost, maxResults] = process.argv.slice(2).map(Number);
  const { getDb } = await import("../src/lib/db/client");
  const { runTdlrPull } = await import("../src/lib/integrations/tdlr/runner");
  const db = await getDb();
  const results = await runTdlrPull(db, {
    sinceDays: Number.isFinite(sinceDays) ? sinceDays : undefined,
    minCost: Number.isFinite(minCost) ? minCost : undefined,
    maxResults: Number.isFinite(maxResults) ? maxResults : undefined,
  });
  console.log(`TDLR: ${results.length} qualifying filings`);
  for (const r of results) console.log(`  ${r.projectNumber} ${r.name} → ${r.status}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
