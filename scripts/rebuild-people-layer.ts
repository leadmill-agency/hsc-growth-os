// One-off (2026-09-21, Rameel): rebuild the contact layer instead of nuking
// the pipeline. 1) purge contacts that aren't PEOPLE AT the company (firms,
// filing agents, outside architects/engineers/brokers); 2) collapse duplicate
// researched cards per account (best score survives); 3) re-run Apollo people
// discovery for every active account; 4) re-enrich emails; 5) recompose the
// active accounts' briefs under the employees-only approach rule; 6) run the
// honest auto-dismiss.
//   npx tsx scripts/rebuild-people-layer.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { opportunities, contacts, accounts, activities, evidence } = await import("../src/lib/db/schema");
  const { and, eq, inArray, sql, desc } = await import("drizzle-orm");
  const { logActivity } = await import("../src/lib/events");
  const db = await getDb();
  const {
    isPersonAtCompany,
    discoverContactsForUncovered,
    enrichResearchedContacts,
    autoDismissUnreachable,
  } = await import("../src/lib/actions/contact-enrichment");

  const activeOpps = await db.query.opportunities.findMany({
    where: inArray(opportunities.stage, ["researching", "researched", "pursuing"]),
  });
  const accountIds = [...new Set(activeOpps.map((o) => o.accountId).filter((x): x is string => !!x))];

  // 1) Purge non-person / external contacts on active accounts.
  const all = accountIds.length
    ? await db.query.contacts.findMany({ where: inArray(contacts.accountId, accountIds) })
    : [];
  let purged = 0;
  for (const c of all) {
    if (isPersonAtCompany(c)) continue;
    await db.delete(contacts).where(eq(contacts.id, c.id));
    purged++;
  }
  console.log(`PURGED=${purged} firm/agent/entity contacts`);

  // 2) Collapse duplicate researched cards per account — best score survives.
  const byAccount = new Map<string, typeof activeOpps>();
  for (const o of activeOpps) {
    if (!o.accountId || ["incoming_bid", "bid"].includes(o.opportunityType ?? "")) continue;
    const list = byAccount.get(o.accountId) ?? [];
    list.push(o);
    byAccount.set(o.accountId, list);
  }
  let collapsed = 0;
  for (const [, list] of byAccount) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => (b.overallScore ?? b.fitScore ?? -1) - (a.overallScore ?? a.fitScore ?? -1)
    );
    for (const dupe of sorted.slice(1)) {
      await db
        .update(opportunities)
        .set({ stage: "dismissed", updatedAt: new Date() })
        .where(eq(opportunities.id, dupe.id));
      await logActivity(db, {
        entityType: "opportunity",
        entityId: dupe.id,
        action: "opportunity.deduped",
        detail: `Duplicate of "${sorted[0].name}" — one card per company`,
        actor: "system",
      });
      collapsed++;
    }
  }
  console.log(`COLLAPSED=${collapsed} duplicate researched card(s)`);

  // 3) Fresh discovery pass: clear markers so every active account re-searches.
  await db.execute(
    sql`delete from activities where action = 'apollo.people_searched' and entity_id = any(${accountIds}::uuid[])`
  );
  let discovered = 0;
  for (let i = 0; i < 30; i++) {
    const d = await discoverContactsForUncovered(db, 5);
    discovered += d;
    if (i > 12 && d === 0) break;
  }
  console.log(`DISCOVERED=${discovered} people at-company`);

  // 4) Emails for everyone new.
  let found = 0;
  for (let i = 0; i < 15; i++) {
    const f = await enrichResearchedContacts(db, 30);
    found += f;
    if (f === 0 && i > 1) break;
  }
  console.log(`ENRICHED=${found} addresses`);

  // 5) Recompose active accounts' briefs under the employees-only rule.
  const { composeReadableBrief } = await import("../src/lib/actions/research-brief");
  const briefRows = accountIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "account"),
          eq(evidence.fieldName, "research_brief"),
          inArray(evidence.entityId, accountIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const seen = new Set<string>();
  let recomposed = 0;
  for (const row of briefRows) {
    if (seen.has(row.entityId)) continue;
    seen.add(row.entityId);
    const v = row.value as Record<string, unknown>;
    const asArr = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);
    const pseudoRaw = {
      headline: String(v.headline ?? v.bottom_line ?? ""),
      about: String(v.who_they_are ?? v.about ?? v.bottom_line ?? ""),
      footprint: asArr(v.footprint),
      signals: [...asArr(v.whats_happening), ...asArr(v.signals), ...(v.opportunity ? [String(v.opportunity)] : [])],
      projects: Array.isArray(v.projects) ? (v.projects as { name: string; detail: string }[]) : [],
      recommendation: String(v.how_to_approach ?? v.recommendation ?? "") || null,
      unknowns: asArr(v.unknowns),
      sources: asArr(v.sources),
      researchedBy: String(v.researchedBy ?? "rebuild"),
    };
    if (!pseudoRaw.about) continue;
    try {
      const readable = await composeReadableBrief(pseudoRaw);
      await db.update(evidence).set({ value: readable }).where(eq(evidence.id, row.id));
      recomposed++;
    } catch (err) {
      console.error(`recompose failed ${row.entityId}:`, (err as Error).message.slice(0, 100));
    }
  }
  console.log(`RECOMPOSED=${recomposed} briefs`);

  // 6) Honest auto-dismiss on the rebuilt data.
  const dismissed = await autoDismissUnreachable(db);
  console.log(`AUTO_DISMISSED=${dismissed}`);

  // Final coverage.
  const activeAfter = await db.query.opportunities.findMany({
    where: inArray(opportunities.stage, ["researching", "researched", "pursuing"]),
    columns: { accountId: true },
  });
  const idsAfter = [...new Set(activeAfter.map((o) => o.accountId).filter((x): x is string => !!x))];
  const withEmail = idsAfter.length
    ? await db.query.contacts.findMany({
        where: and(inArray(contacts.accountId, idsAfter), sql`${contacts.email} is not null`),
      })
    : [];
  console.log(
    `FINAL: ${new Set(withEmail.map((c) => c.accountId)).size}/${idsAfter.length} active companies emailable (${withEmail.length} addresses, all people at-company)`
  );
  void accounts;
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
