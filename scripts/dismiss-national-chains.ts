// One-time cleanup (Rameel 2026-09-19): Fortune-1000-scale corporate chains
// leave the opportunity lists — their sign packages go through national vendor
// programs HSC can't win at its size. Franchisee-driven buildouts stay (the
// local operator buys the signs). Going forward PB05 skips these at parse time
// (national_chain flag); this closes the cards already in the database.
// Dismissals are logged with reasonCode national_chain so the radar's
// dismissal feedback learns the pattern as owner ground truth.
//   npx tsx scripts/dismiss-national-chains.ts [--apply]
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

// Exact card names from the 2026-09-19 review of active opportunities.
const NATIONAL_CHAIN_CARDS = [
  "Five Below — Five Below - 925 N. Shepherd Dr.",
  "Costco Wholesale — Carwash",
  "Rooms To Go — Grand Central Park (City Central/336 Marketplace commercial districts)",
  "Rooms To Go — Rooms To Go — new furniture superstore in Conroe (Grand Central Park)",
  "FIFTH THIRD",
  "Prosperity Bank — Operational conversion of American Bank systems to Prosperity platforms",
  "CommonSpirit — St. Luke’s Health rebrand to CommonSpirit",
  "ExxonMobil Energy 4 — EMHC Energy 4 UPS Upgrade",
  "Casey’s",
  "Casey’s — Casey's conversion program for former CEFCO stores in Texas",
  "United Supermarkets (The United Family) — Hereford conversion",
  "Concentra — Lake Line",
  "Encompass Health — Encompass Health Inpatient Rehabilitation Hospital of Conroe",
  "Tropical Smoothie Cafe — systemwide brand transformation",
  "Dutch Bros Coffee — Houston expansion",
  "Mitsubishi Corporation (Americas) — MCA & MCEC - Levels 31-33",
  "MCA — MCA - Level 34",
  "Quanta — QUANTA LEVELS 6-8",
  "CareNow Urgent Care — Houston expansion",
  "Crash Champions — Crash Champions - Bastrop",
];

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { opportunities } = await import("../src/lib/db/schema");
  const { logActivity } = await import("../src/lib/events");
  const { eq, inArray } = await import("drizzle-orm");
  const db = await getDb();

  const rows = await db.query.opportunities.findMany({
    where: inArray(opportunities.name, NATIONAL_CHAIN_CARDS),
  });
  const active = rows.filter((o) => !["dismissed", "won", "lost"].includes(o.stage ?? ""));
  const missing = NATIONAL_CHAIN_CARDS.filter((n) => !rows.some((r) => r.name === n));
  for (const name of missing) console.log(`NOT FOUND (skipped): ${name}`);

  for (const o of active) {
    console.log(`${APPLY ? "DISMISS" : "would dismiss"}: "${o.name}" [${o.stage}, score ${o.overallScore}]`);
    if (!APPLY) continue;
    await db
      .update(opportunities)
      .set({ stage: "dismissed", updatedAt: new Date() })
      .where(eq(opportunities.id, o.id));
    await logActivity(db, {
      entityType: "opportunity",
      entityId: o.id,
      action: "opportunity.dismissed",
      detail: `${o.name} dismissed: national chain — corporate sign program, beyond our scale`,
      actor: "system",
      metadata: {
        reasonCode: "national_chain",
        source: o.source ?? undefined,
        score: o.overallScore ?? undefined,
      },
    });
  }
  console.log(`${APPLY ? "Dismissed" : "Would dismiss"} ${active.length} national-chain card(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
