// One-off (2026-09-10, per Rameel): clear the Researched Opportunities tab for
// a fresh start tomorrow. Dismisses every researched/pursuing non-bid
// opportunity and deletes their pending email drafts. Research artifacts
// (accounts, contacts, evidence) are KEPT — only the working list is cleared.
//   node scripts/reset-researched.mjs
import postgres from "postgres";
import { readFileSync } from "fs";

const url = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();
const sql = postgres(url, { prepare: false, onnotice: () => {} });

await sql.begin(async (tx) => {
  const opps = await tx`update opportunities set stage = 'dismissed',
    next_action = null,
    source_detail = coalesce(source_detail, '') || ' [cleared 2026-09-10 fresh start]',
    updated_at = now()
    where stage in ('researching', 'researched', 'pursuing')
      and coalesce(opportunity_type, '') not in ('incoming_bid', 'bid')
    returning id, name`;
  console.log(`${opps.length} researched opportunities cleared`);

  const drafts = await tx`delete from approvals
    where status = 'pending' and approval_type in ('send_outreach', 'send_followup')
    returning title`;
  console.log(`${drafts.length} pending email drafts deleted`);

  await tx`insert into activities (entity_type, entity_id, actor, action, detail)
    values ('system', '00000000-0000-0000-0000-000000000000', 'user', 'system.reset',
      ${'Researched tab cleared for a fresh start (' + opps.length + ' cards, ' + drafts.length + ' drafts). Accounts, contacts, and research evidence kept.'})`;
});
await sql.end();
console.log("reset committed");
