// One-off (2026-09-11): research runs before today stored their briefs only in
// step outputs. Rebuild the normalized account research_brief evidence from
// completed runs so account pages show real briefs. Idempotent per account.
//   npx tsx scripts/backfill-research-briefs.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { ploybookRuns, ploybookSteps, evidence } = await import("../src/lib/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { saveAccountResearchBrief, briefFromResearch, briefFromPortfolio, briefFromBrand } =
    await import("../src/lib/actions/research-brief");
  const db = await getDb();

  const runs = await db.query.ploybookRuns.findMany({
    where: and(
      eq(ploybookRuns.status, "completed"),
      inArray(ploybookRuns.ploybookKey, [
        "pb01_gc_pursuit",
        "pb03_franchise_expansion",
        "pb04_facility_portfolio",
        "pb09_account_research",
      ])
    ),
  });
  console.log(`${runs.length} completed research runs to inspect`);
  const done = new Set<string>();

  for (const run of runs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const steps = await db.query.ploybookSteps.findMany({ where: eq(ploybookSteps.runId, run.id) });
    const out = new Map(steps.map((s) => [s.stepKey, (s.outputs ?? {}) as Record<string, unknown>]));
    let accountId: string | undefined;
    let brief = null;
    try {
      if (run.ploybookKey === "pb04_facility_portfolio") {
        accountId = out.get("create_operator_account")?.accountId as string;
        const profile = out.get("research_portfolio")?.profile;
        const sources = (out.get("research_portfolio")?.sources ?? []) as { url: string }[];
        const rec = out.get("portfolio_recommendation")?.recommendation as { motion?: string };
        if (profile) brief = briefFromPortfolio(profile as never, rec ?? null, sources.map((s) => s.url));
      } else if (run.ploybookKey === "pb03_franchise_expansion") {
        accountId = out.get("create_brand_account")?.accountId as string;
        const profile = out.get("research_footprint")?.profile;
        const sources = (out.get("research_footprint")?.sources ?? []) as { url: string }[];
        const rec = out.get("rollout_recommendation")?.recommendation as { motion?: string };
        if (profile) brief = briefFromBrand(profile as never, rec?.motion ?? null, sources.map((s) => s.url));
      } else {
        const anchor = run.ploybookKey === "pb09_account_research" ? "resolve_account" : "normalize_entities";
        const researchStep = run.ploybookKey === "pb09_account_research" ? "research_brief" : "research";
        accountId = out.get(anchor)?.accountId as string;
        const b = out.get(researchStep)?.brief;
        const sources = (out.get(researchStep)?.sources ?? []) as { url: string }[];
        if (b) brief = briefFromResearch(b as never, sources.map((s) => s.url), run.ploybookKey);
      }
    } catch (err) {
      console.log(` skip ${run.id}: ${(err as Error).message.slice(0, 80)}`);
      continue;
    }
    if (!accountId || !brief || done.has(accountId)) continue;
    const existing = await db.query.evidence.findFirst({
      where: and(
        eq(evidence.entityType, "account"),
        eq(evidence.entityId, accountId),
        eq(evidence.fieldName, "research_brief")
      ),
    });
    if (existing) {
      done.add(accountId);
      continue;
    }
    await saveAccountResearchBrief(db, { accountId, ploybookRunId: run.id, brief });
    done.add(accountId);
    console.log(` brief saved: ${brief.headline.slice(0, 70)}`);
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
