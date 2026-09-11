import { getDb } from "@/lib/db/client";
import { activities, approvals } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Full audit log (§21) — moved off Home per Rameel: it's for tracing what the
// system did, not for daily monitoring.

export default async function HistoryPage() {
  const db = await getDb();
  const rows = await db.query.activities.findMany({
    orderBy: desc(activities.occurredAt),
    limit: 200,
  });

  // Every email that actually left the building, verbatim (per Rameel
  // 2026-09-11: "i want to be able to see the emails that get sent").
  const sentEmails = await db.query.approvals.findMany({
    where: sql`${approvals.payload}->>'sentAt' is not null`,
    orderBy: desc(approvals.resolvedAt),
    limit: 50,
  });

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="text-sm text-steel">
        Everything the system and the team did, newest first. Every action is attributed — no
        black-box automation.
      </p>
      {sentEmails.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-700">
            Emails sent ({sentEmails.length})
          </h2>
          {sentEmails.map((a) => {
            const p = (a.payload ?? {}) as {
              sentAt?: string;
              sentTo?: string;
              sentSubject?: string;
              sentBody?: string;
              draft?: { subject?: string; body?: string };
            };
            return (
              <details key={a.id} className="rounded-lg border border-fog bg-white px-4 py-2.5">
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium">{p.sentSubject ?? p.draft?.subject ?? a.title}</span>{" "}
                  <span className="text-xs text-steel">
                    → {p.sentTo ?? "recipient not recorded"} ·{" "}
                    {p.sentAt ? p.sentAt.slice(0, 16).replace("T", " ") : ""}
                  </span>
                </summary>
                <p className="mt-2 whitespace-pre-wrap border-t border-cloud pt-2 text-sm leading-relaxed text-ink-700">
                  {p.sentBody ?? p.draft?.body ?? "(body not recorded — sent before 2026-09-11)"}
                </p>
              </details>
            );
          })}
        </section>
      )}

      <h2 className="text-sm font-semibold text-ink-700">Activity log</h2>
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
