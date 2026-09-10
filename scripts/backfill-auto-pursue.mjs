// One-off (2026-09-10): before the cap-deferral fix, discovered events for 75+
// opportunities beyond the daily cap were marked processed and dropped — those
// cards never auto-researched. Queue pursuits for them now (best score first,
// respecting today's remaining auto-pursue budget). Runs are left queued; the
// prod scheduler's orphan pickup executes them within ~15 minutes.
//   node scripts/backfill-auto-pursue.mjs
import { readFileSync } from "node:fs";

for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { getDb } = await import("../src/lib/db/client.ts");
await import("../src/lib/ploybooks/index.ts");
const { launchPursuit, autoPursuitsToday, autoPursueDailyCap, AUTO_PURSUE_TRIGGER } = await import(
  "../src/lib/actions/pursue.ts"
);
const { opportunities } = await import("../src/lib/db/schema/index.ts");
const { eq, desc, sql } = await import("drizzle-orm");

const db = await getDb();
const used = await autoPursuitsToday(db);
const budget = autoPursueDailyCap() - used;
console.log(`auto-pursue budget: ${budget} left today (${used} used, cap ${autoPursueDailyCap()})`);

const candidates = await db.query.opportunities.findMany({
  where: sql`${opportunities.stage} = 'discovered' and coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, 0) >= 75`,
  orderBy: desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, 0)`),
  limit: Math.max(budget, 0),
});
console.log(`${candidates.length} unresearched 75+ opportunities to queue`);
for (const opp of candidates) {
  const result = await launchPursuit(db, opp.id, {
    triggerType: AUTO_PURSUE_TRIGGER,
    initiatedBy: "system",
  });
  console.log(
    ` ${opp.overallScore ?? opp.fitScore} ${opp.name} → ${result.runId ? `queued ${result.runId.slice(0, 8)}` : (result.reason ?? "skipped")}`
  );
  void eq;
}
process.exit(0);
