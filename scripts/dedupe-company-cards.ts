// One-time cleanup for company-level duplicates (Rameel 2026-09-19): the scout
// re-told the same story daily with new wording, so dismissed companies kept
// re-entering the inbox as fresh cards. Going forward PB05 dedupes account-wide;
// this script closes the duplicates already in the database.
//
// Rules (bids excluded — a GC legitimately gets one card per project):
// - Group non-bid opportunities by normalized company-name prefix.
// - If the group has a dismissed/won/lost card, every 'discovered' card in the
//   group is a duplicate → dismissed.
// - Otherwise the OLDEST 'discovered' card stays, younger ones are dismissed.
// - Logged as action 'opportunity.deduped' (actor system), deliberately NOT
//   'opportunity.dismissed' so the radar's dismissal feedback never learns
//   from system dedupes.
//   npx tsx scripts/dedupe-company-cards.ts [--apply]
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { opportunities } = await import("../src/lib/db/schema");
  const { logActivity } = await import("../src/lib/events");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();

  const all = await db.query.opportunities.findMany();
  // Excluded from grouping: bids (one per project is correct), website-visitor
  // cards (the shared "Website visitor:" prefix is not a company), and
  // owner-unknown project cards (Building 04 vs 05 are different objects).
  const isBid = (o: (typeof all)[number]) =>
    o.stage === "bid_invited" ||
    o.name.includes("(bid)") ||
    o.source === "email_inbound" ||
    o.name.startsWith("Website visitor:") ||
    o.name.includes("(owner unknown)");
  const prefix = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 14);

  const groups = new Map<string, typeof all>();
  for (const o of all) {
    if (isBid(o)) continue;
    const key = prefix(o.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }

  const terminal = new Set(["dismissed", "won", "lost"]);
  let closed = 0;
  for (const [, members] of groups) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const closedCard = members.find((o) => terminal.has(o.stage ?? ""));
    const discovered = members.filter((o) => o.stage === "discovered");
    // With a closed card in the group every discovered member is a duplicate;
    // without one, the oldest discovered card survives.
    const toClose = closedCard ? discovered : discovered.slice(1);
    const keeper = closedCard ?? discovered[0];
    for (const dupe of toClose) {
      if (dupe.id === keeper?.id) continue;
      closed++;
      console.log(
        `${APPLY ? "DISMISS" : "would dismiss"}: "${dupe.name}" (${dupe.createdAt.toISOString().slice(0, 10)}) — duplicate of "${keeper?.name}" [${keeper?.stage}]`
      );
      if (!APPLY) continue;
      await db
        .update(opportunities)
        .set({ stage: "dismissed", updatedAt: new Date() })
        .where(eq(opportunities.id, dupe.id));
      await logActivity(db, {
        entityType: "opportunity",
        entityId: dupe.id,
        action: "opportunity.deduped",
        detail: `Duplicate of "${keeper?.name}" (${keeper?.stage}) — closed by company-level dedupe cleanup`,
        actor: "system",
      });
    }
  }
  console.log(`${APPLY ? "Closed" : "Would close"} ${closed} duplicate card(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
