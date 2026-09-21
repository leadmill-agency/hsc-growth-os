// One-off (2026-09-21): re-compose EVERY stored research brief with the fixed
// "how to approach" prompt — the old ones read like robot ops manuals
// ("prioritize monitored outreach"). Handles both raw-mapped briefs and
// already-composed ones by rebuilding a pseudo-raw from whatever fields exist.
//   npx tsx scripts/repolish-briefs-v2.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { evidence } = await import("../src/lib/db/schema");
  const { and, eq, desc } = await import("drizzle-orm");
  const { composeReadableBrief } = await import("../src/lib/actions/research-brief");
  const db = await getDb();

  const rows = await db.query.evidence.findMany({
    where: and(eq(evidence.entityType, "account"), eq(evidence.fieldName, "research_brief")),
    orderBy: desc(evidence.retrievedAt),
  });
  // Latest brief per account only.
  const seen = new Set<string>();
  let done = 0;
  for (const row of rows) {
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
      researchedBy: String(v.researchedBy ?? "repolish"),
    };
    if (!pseudoRaw.about) {
      console.log(`SKIP (empty): ${row.entityId}`);
      continue;
    }
    try {
      const readable = await composeReadableBrief(pseudoRaw);
      await db.update(evidence).set({ value: readable }).where(eq(evidence.id, row.id));
      done++;
      console.log(`REPOLISHED: ${row.entityId} — approach now: "${readable.how_to_approach.slice(0, 110)}..."`);
    } catch (err) {
      console.error(`FAILED ${row.entityId}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`Repolished ${done} brief(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
