// Manual "run today's intake now" — same sequence the 8am scheduler tick runs:
// TDLR + CoH pull → expansion scout → PB18 brief. Safe to run any time; each
// stage marks its UTC day done so the scheduled tick won't double-run it.
//   npx tsx scripts/run-intake-now.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  await import("../src/lib/ploybooks");
  const db = await getDb();

  const { tdlrPulledToday, runTdlrPull } = await import("../src/lib/integrations/tdlr/runner");
  if (await tdlrPulledToday(db)) {
    console.log("TDLR+CoH: already ran today, skipping");
  } else {
    const results = await runTdlrPull(db);
    console.log(`TDLR+CoH: ${results.length} signals fed to radar`);
  }

  const { scoutRanToday, runExpansionScout } = await import("../src/lib/integrations/scout/client");
  if (await scoutRanToday(db)) {
    console.log("Scout: already ran today, skipping");
  } else {
    const found = await runExpansionScout(db);
    console.log(`Scout: ${found.length} discoveries fed to radar`);
  }

  // Give the radar runs a moment isn't needed — runTdlrPull/scout execute their
  // PB05 runs inline. Fresh brief on top of the new data:
  const { launchRun, executeRun } = await import("../src/lib/ploybooks/runner");
  const runId = await launchRun(db, {
    ploybookKey: "pb18_growth_operator",
    triggerType: "scheduled",
    triggerPayload: {},
    initiatedBy: "system",
  });
  await executeRun(db, runId);
  console.log("PB18 brief regenerated");
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
