// One-off (2026-09-21): classify every existing opportunity as rollout vs
// one_off for the new inbox split. Rules first (free), LLM in batches for the
// rest (~fractions of a cent per card). Bids are one_off-exempt (own tab).
//   npx tsx scripts/backfill-scale.ts [--apply]
import { readFileSync } from "node:fs";
import { z } from "zod";

const APPLY = process.argv.includes("--apply");

const ROLLOUT_HINTS =
  /franchis|multi.?unit|multi.?location|rollout|area development|development agreement|first .{0,20}(location|studio|store|unit|café|cafe)|market entry|expansion|conversion program|rebrand|marketplace|retail center|mixed.?use|shopping center|units?\b.{0,10}deal|\b\d+[- ](unit|store|studio|location)/i;

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { opportunities, accounts, evidence } = await import("../src/lib/db/schema");
  const { eq, inArray, isNull, and } = await import("drizzle-orm");
  const db = await getDb();

  const rows = await db.query.opportunities.findMany({ where: isNull(opportunities.scale) });
  console.log(`${rows.length} unclassified opportunities`);

  const accountIds = [...new Set(rows.map((r) => r.accountId).filter((x): x is string => !!x))];
  const accts = accountIds.length
    ? await db.query.accounts.findMany({ where: inArray(accounts.id, accountIds) })
    : [];
  const acctById = new Map(accts.map((a) => [a.id, a]));
  const whyRows = await db.query.evidence.findMany({
    where: and(eq(evidence.entityType, "opportunity"), eq(evidence.fieldName, "why_this_matters")),
  });
  const whyByOpp = new Map<string, string>();
  for (const w of whyRows) if (!whyByOpp.has(w.entityId)) whyByOpp.set(w.entityId, String(w.value ?? ""));

  const ROLLOUT_TYPES = new Set(["franchise", "developer", "facility_operator"]);
  const decided = new Map<string, "rollout" | "one_off">();
  const uncertain: typeof rows = [];

  for (const o of rows) {
    const acct = o.accountId ? acctById.get(o.accountId) : null;
    const text = `${o.name} ${whyByOpp.get(o.id) ?? ""} ${o.opportunityType ?? ""}`;
    if (["incoming_bid", "bid"].includes(o.opportunityType ?? "") || o.stage === "bid_invited") {
      decided.set(o.id, "one_off"); // bids live in their own tab; scale is moot
    } else if (ROLLOUT_TYPES.has(acct?.accountType ?? "") || ROLLOUT_HINTS.test(text)) {
      decided.set(o.id, "rollout");
    } else {
      uncertain.push(o);
    }
  }
  console.log(`rules: ${[...decided.values()].filter((v) => v === "rollout").length} rollout, ${[...decided.values()].filter((v) => v === "one_off").length} one_off(bid); ${uncertain.length} to LLM`);

  const { getLLMClient } = await import("../src/lib/ai/client");
  const llm = getLLMClient();
  const batchSchema = z.object({
    classifications: z.array(z.object({ index: z.number(), scale: z.enum(["rollout", "one_off"]) })),
  });
  for (let i = 0; i < uncertain.length; i += 30) {
    const batch = uncertain.slice(i, i + 30);
    const lines = batch
      .map((o, idx) => `${idx}. ${o.name} — ${(whyByOpp.get(o.id) ?? "").slice(0, 160)}`)
      .join("\n");
    const out = await llm.generateStructured({
      system:
        "Classify sign-business opportunities for a Houston sign company. scale='rollout' " +
        "when a repeat-purchase relationship is at stake: franchise expansions, brands " +
        "entering a market, operators with 3+ locations, multi-tenant developments, system " +
        "rebrands. scale='one_off' for a single business in a single space (one CO, one " +
        "finish-out, one filing). When torn, one_off.",
      prompt: `Classify each by index:\n${lines}`,
      schema: batchSchema,
      effort: "low",
    });
    for (const c of out.classifications) {
      const o = batch[c.index];
      if (o) decided.set(o.id, c.scale);
    }
    console.log(`LLM batch ${i / 30 + 1}: ${batch.length} classified`);
  }

  let rollouts = 0;
  for (const o of rows) {
    const scale = decided.get(o.id) ?? "one_off";
    if (scale === "rollout") rollouts++;
    if (!APPLY) continue;
    await db.update(opportunities).set({ scale }).where(eq(opportunities.id, o.id));
  }
  console.log(`${APPLY ? "Applied" : "Would apply"}: ${rollouts} rollout, ${rows.length - rollouts} one_off.`);
  if (!APPLY) {
    const sample = rows.filter((o) => decided.get(o.id) === "rollout" && o.stage === "discovered").slice(0, 25);
    for (const o of sample) console.log(`  ROLLOUT: ${o.name}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
