// One-off migration (2026-09-10) to the triage→research→act flow:
// - pending accept_bid approvals become triage cards: recommendation copied to
//   the opportunity's nextAction, approval deleted, PB10 run closed out
// - opportunities stuck "researching" under the old approval gate move to
//   "researched" (their PB01 runs closed out) so their cards show actions
//   node scripts/migrate-to-researched-flow.mjs
import postgres from "postgres";
import { readFileSync } from "fs";

const url = readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="))
  .slice("DATABASE_URL=".length)
  .trim();
const sql = postgres(url, { prepare: false, onnotice: () => {} });

await sql.begin(async (tx) => {
  // 1) accept_bid approvals → nextAction on the opportunity, then delete.
  const bidApprovals = await tx`
    select a.id, a.title, a.payload->>'bidId' bid_id, b.opportunity_id
    from approvals a left join bids b on b.id = (a.payload->>'bidId')::uuid
    where a.status = 'pending' and a.approval_type = 'accept_bid'`;
  for (const a of bidApprovals) {
    const rec = a.title.split(":")[0]; // "REVIEW" / "BID" / "PASS"
    if (a.opportunity_id) {
      await tx`update opportunities set next_action = ${rec + " recommended"}, updated_at = now()
        where id = ${a.opportunity_id} and next_action is null`;
    }
    await tx`delete from approvals where id = ${a.id}`;
  }
  console.log(`${bidApprovals.length} accept_bid approvals converted to triage cards`);

  // 2) PB10 runs stuck waiting on those approvals → completed.
  const r1 = await tx`update ploybook_runs set status = 'completed', result_summary = 'closed by researched-flow migration', updated_at = now()
    where ploybook_key = 'pb10_incoming_bid' and status = 'waiting_for_approval' returning id`;
  // 3) PB01 runs waiting on old outreach approvals → completed.
  const r2 = await tx`update ploybook_runs set status = 'completed', result_summary = 'closed by researched-flow migration', updated_at = now()
    where ploybook_key = 'pb01_gc_pursuit' and status = 'waiting_for_approval' returning id`;
  console.log(`runs closed: ${r1.length} pb10, ${r2.length} pb01`);

  // 4) researching → researched so cards get their action buttons.
  const r3 = await tx`update opportunities set stage = 'researched',
    next_action = coalesce(next_action, 'Research ready — review in Researched'), updated_at = now()
    where stage = 'researching' returning id`;
  console.log(`${r3.length} opportunities moved researching → researched`);
});
await sql.end();
console.log("migration committed");
