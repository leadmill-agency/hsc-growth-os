import postgres from "postgres";
import { readFileSync } from "fs";
const url = readFileSync(new URL("./.env", import.meta.url), "utf8").split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const sql = postgres(url, { prepare: false, onnotice: () => {} });
for (let i = 0; i < 120; i++) {
  const [running] = await sql`select count(*) n from ploybook_runs where status in ('running','queued') and ploybook_key in ('pb01_gc_pursuit','pb02_commercial_development','pb03_franchise_expansion','pb04_facility_portfolio')`;
  if (Number(running.n) === 0) {
    const r = await sql`update opportunities set stage = 'discovered', next_action = 'Auto-researched this morning — brief already on the account; your call', updated_at = now()
      where stage in ('researching','researched') and coalesce(opportunity_type,'') not in ('incoming_bid','bid') returning id`;
    console.log(`all in-flight research finished; final sweep returned ${r.length} card(s) to the inbox`);
    break;
  }
  await new Promise((res) => setTimeout(res, 15000));
}
await sql.end();
