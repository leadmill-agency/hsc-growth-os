// One-off data repair (2026-09-10): opportunities created before the
// project-only dedupe fix in createOpportunity() exist in duplicate pairs
// (same name, account null). Keep the OLDEST of each group, repoint every
// reference (evidence, activities, bids, followups, events, proposals) to it,
// and delete the rest. Idempotent: reruns find zero groups.
//   node scripts/merge-duplicate-opportunities.mjs
import postgres from "postgres";
import { readFileSync } from "fs";

const url = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();
const sql = postgres(url, { prepare: false });

const groups = await sql`
  select name, array_agg(id order by created_at) ids, count(*) n
  from opportunities group by name having count(*) > 1`;
console.log(`${groups.length} duplicate groups`);

await sql.begin(async (tx) => {
  for (const g of groups) {
    const [keep, ...drop] = g.ids;
    for (const dupId of drop) {
      await tx`update evidence set entity_id = ${keep} where entity_type = 'opportunity' and entity_id = ${dupId}`;
      await tx`update activities set entity_id = ${keep} where entity_type = 'opportunity' and entity_id = ${dupId}`;
      await tx`update bids set opportunity_id = ${keep} where opportunity_id = ${dupId}`;
      await tx`update followups set opportunity_id = ${keep} where opportunity_id = ${dupId}`;
      await tx`update events set opportunity_id = ${keep} where opportunity_id = ${dupId}`;
      await tx`update proposals set opportunity_id = ${keep} where opportunity_id = ${dupId}`;
      await tx`delete from opportunities where id = ${dupId}`;
      console.log(`merged "${g.name}": ${dupId} -> ${keep}`);
    }
  }
});
const [after] = await sql`select count(*) n from opportunities`;
console.log("opportunities remaining:", after.n);
await sql.end();
