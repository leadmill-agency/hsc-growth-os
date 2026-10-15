// Weekly SEO publish helper (Rameel 2026-10-15: "shouldn't you automatically
// just do the seo work to publish?"). Used by the weekly publish task.
//
//   npx tsx scripts/seo-drafts.ts list [outFile]
//       Unhandled PB16/PB17 drafts (publish_page / publish_content that are
//       pending, or approved but never published). Full drafts go to outFile
//       (JSON) when given; a summary prints either way.
//   npx tsx scripts/seo-drafts.ts resolve <approvalId> <published|skipped> "<note>" [liveUrl]
//       Records the outcome on the approval so it never comes back.
import { readFileSync, writeFileSync } from "fs";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { getDb } = await import("../src/lib/db/client");
  const db = await getDb();
  const { approvals } = await import("../src/lib/db/schema");
  const { and, eq, inArray, sql } = await import("drizzle-orm");

  if (cmd === "list") {
    const rows = await db
      .select()
      .from(approvals)
      .where(
        and(
          inArray(approvals.approvalType, ["publish_page", "publish_content"]),
          inArray(approvals.status, ["pending", "approved", "edited"]),
          sql`${approvals.resolutionPayload}->>'publishOutcome' is null`
        )
      )
      .orderBy(approvals.requestedAt);
    for (const r of rows) {
      console.log(`${r.requestedAt.toISOString().slice(0, 10)}  ${r.status.padEnd(8)}  ${r.id}  ${r.title}`);
    }
    if (!rows.length) console.log("No unhandled SEO drafts.");
    if (args[0]) writeFileSync(args[0], JSON.stringify(rows, null, 2));
  } else if (cmd === "resolve") {
    const [id, outcome, note, liveUrl] = args;
    if (!id || !["published", "skipped"].includes(outcome)) {
      throw new Error('usage: resolve <approvalId> <published|skipped> "<note>" [liveUrl]');
    }
    const row = await db.query.approvals.findFirst({ where: eq(approvals.id, id) });
    if (!row) throw new Error(`approval ${id} not found`);
    await db
      .update(approvals)
      .set({
        status: outcome === "published" ? "approved" : "rejected",
        resolvedAt: row.resolvedAt ?? new Date(),
        resolvedBy: row.resolvedBy ?? "claude-weekly-publish",
        resolutionPayload: {
          ...((row.resolutionPayload as Record<string, unknown>) ?? {}),
          publishOutcome: outcome,
          publishNote: note ?? null,
          liveUrl: liveUrl ?? null,
          handledAt: new Date().toISOString(),
        },
      })
      .where(eq(approvals.id, id));
    console.log(`${id} -> ${outcome}`);
  } else {
    throw new Error("usage: list [outFile] | resolve <id> <published|skipped> <note> [liveUrl]");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
