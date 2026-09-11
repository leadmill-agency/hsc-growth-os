// One-off (2026-09-11): rewrite stored raw-mapped research briefs into the
// readable presidential-style shape. Skips rows already composed (bottom_line
// present). ~1 cent per brief on the small model.
//   npx tsx scripts/repolish-research-briefs.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { evidence } = await import("../src/lib/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const { composeReadableBrief } = await import("../src/lib/actions/research-brief");
  const db = await getDb();

  const rows = await db.query.evidence.findMany({
    where: and(eq(evidence.entityType, "account"), eq(evidence.fieldName, "research_brief")),
  });
  console.log(`${rows.length} stored briefs`);
  for (const row of rows) {
    const value = row.value as Record<string, unknown>;
    if (value.bottom_line) continue; // already readable
    try {
      const readable = await composeReadableBrief(value as never);
      await db
        .update(evidence)
        .set({ value: readable })
        .where(eq(evidence.id, row.id));
      console.log(` rewrote: ${String(readable.bottom_line).slice(0, 90)}`);
    } catch (err) {
      console.log(` FAILED ${row.entityId}: ${(err as Error).message.slice(0, 80)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
