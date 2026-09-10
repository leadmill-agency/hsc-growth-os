import { getDb } from "@/lib/db/client";
import { activities } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Full audit log (§21) — moved off Home per Rameel: it's for tracing what the
// system did, not for daily monitoring.

export default async function HistoryPage() {
  const db = await getDb();
  const rows = await db.query.activities.findMany({
    orderBy: desc(activities.occurredAt),
    limit: 200,
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="text-sm text-steel">
        Everything the system and the team did, newest first. Every action is attributed — no
        black-box automation.
      </p>
      <ul className="space-y-1 text-xs text-steel">
        {rows.map((a) => (
          <li key={a.id}>
            <span className="font-mono text-steel/70">
              {a.occurredAt.toISOString().slice(0, 16).replace("T", " ")}
            </span>{" "}
            <span className="font-medium text-ink-700">{a.action}</span>
            {a.detail ? ` — ${a.detail}` : ""} <span className="text-steel/60">({a.actor})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
