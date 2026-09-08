// Daily TDLR radar pull: fetch recent Greater Houston TABS filings and feed each
// through PB05 Opportunity Radar. Run manually or on a schedule:
//   npm run radar:tdlr           (defaults: 3 days back, >= $200k, max 20)
//   npm run radar:tdlr -- 7 500000 10   (sinceDays minCost maxResults)
// Reads .env itself so it works from cron without a wrapper.

import { readFileSync } from "node:fs";
import { fetchRecentHoustonProjects, formatTdlrSignal } from "../src/lib/integrations/tdlr/client";

async function main() {
  try {
    for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    // no .env — rely on process env
  }

  const [sinceDays, minCost, maxResults] = process.argv.slice(2).map(Number);
  const { getDb } = await import("../src/lib/db/client");
  await import("../src/lib/ploybooks");
  const { launchRun, executeRun } = await import("../src/lib/ploybooks/runner");

  const db = await getDb();
  const projects = await fetchRecentHoustonProjects({
    sinceDays: Number.isFinite(sinceDays) ? sinceDays : undefined,
    minCost: Number.isFinite(minCost) ? minCost : undefined,
    maxResults: Number.isFinite(maxResults) ? maxResults : undefined,
  });
  console.log(`TDLR: ${projects.length} qualifying filings`);

  for (const project of projects) {
    const { signalText, sourceUrl } = formatTdlrSignal(project);
    const runId = await launchRun(db, {
      ploybookKey: "pb05_opportunity_radar",
      triggerType: "scheduled",
      triggerPayload: { signalText, sourceUrl, source: "tdlr" },
      initiatedBy: "system",
    });
    const status = await executeRun(db, runId);
    console.log(`  ${project.ProjectNumber} ${project.ProjectName} → ${status}`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
