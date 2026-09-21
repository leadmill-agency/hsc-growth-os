import type { Db } from "@/lib/db/client";
import { opportunities } from "@/lib/db/schema";
import { and, eq, lt, inArray } from "drizzle-orm";
import { logActivity } from "@/lib/events";

// One-off cards idle for 7 days quietly archive (Rameel 2026-09-21: "if I
// wanted small projects on TDLR I'd just scroll there"). Rollouts never
// expire, pinned cards never expire (Keep button), and a fresh signal about
// an archived company resurfaces the card (PB05 handles that). Archiving is
// its own stage + activity so the radar's dismissal feedback never learns
// from it — expiry is not a judgment about the opportunity.

export const ONE_OFF_TTL_MS = 7 * 24 * 3600 * 1000;

export async function archiveStaleOneOffs(db: Db): Promise<number> {
  const cutoff = new Date(Date.now() - ONE_OFF_TTL_MS);
  const stale = await db.query.opportunities.findMany({
    where: and(
      inArray(opportunities.stage, ["discovered"]),
      eq(opportunities.scale, "one_off"),
      eq(opportunities.pinned, false),
      lt(opportunities.updatedAt, cutoff)
    ),
    limit: 200,
  });
  for (const o of stale) {
    await db
      .update(opportunities)
      .set({ stage: "archived", updatedAt: new Date() })
      .where(eq(opportunities.id, o.id));
    await logActivity(db, {
      entityType: "opportunity",
      entityId: o.id,
      action: "opportunity.archived",
      detail: `${o.name} archived — one-off card untouched for 7 days (resurfaces on a new signal)`,
      actor: "system",
    });
  }
  return stale.length;
}
