import { readFileSync } from "node:fs";
async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { contacts, activities } = await import("../src/lib/db/schema");
  const { and, eq, gte, inArray, sql } = await import("drizzle-orm");
  const db = await getDb();

  // 1) Retry the 4 rate-limited research runs, one at a time.
  const failed = (await db.execute(sql`
    select id from ploybook_runs where status='failed' and ploybook_key='pb01_gc_pursuit'
      and created_at > now() - interval '1 day'`)) as unknown as { id: string }[];
  const { retryRun } = await import("../src/lib/ploybooks/runner");
  await import("../src/lib/ploybooks");
  for (const r of ((failed as any).rows ?? failed)) {
    console.log(`RETRYING run ${r.id}...`);
    try {
      const status = await retryRun(db, r.id);
      console.log(`  -> ${status}`);
    } catch (e) {
      console.log(`  -> retry failed: ${(e as Error).message.slice(0, 120)}`);
    }
  }

  // 2) Re-lookup contacts wrongly flagged moved-on (guard is org-aware now).
  const moved = await db.query.activities.findMany({
    where: and(eq(activities.action, "contact.moved_on"), gte(activities.occurredAt, new Date(Date.now() - 2 * 86400000))),
  });
  const ids = [...new Set(moved.map((m) => m.entityId))];
  if (ids.length) {
    await db.update(contacts).set({ emailLookupAt: null }).where(inArray(contacts.id, ids));
    console.log(`RESET ${ids.length} moved-on contacts for re-lookup`);
  }
  const { enrichResearchedContacts } = await import("../src/lib/actions/contact-enrichment");
  let found = 0;
  for (let i = 0; i < 12; i++) {
    const f = await enrichResearchedContacts(db, 20);
    found += f;
    if (f === 0 && i > 1) break;
  }
  console.log(`RE-LOOKUP: ${found} emails recovered`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
