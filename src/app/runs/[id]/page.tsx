import { getDb } from "@/lib/db/client";
import { ploybookRuns, ploybookSteps, activities } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const stepBadge: Record<string, string> = {
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  waiting_for_approval: "bg-amber-100 text-amber-800",
  running: "bg-blue-100 text-blue-800",
  pending: "bg-zinc-100 text-zinc-600",
  skipped: "bg-zinc-100 text-zinc-500",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, id) });
  if (!run) notFound();

  const steps = await db.query.ploybookSteps.findMany({
    where: eq(ploybookSteps.runId, id),
    orderBy: asc(ploybookSteps.stepOrder),
  });
  const log = await db.query.activities.findMany({
    where: eq(activities.ploybookRunId, id),
    orderBy: desc(activities.occurredAt),
    limit: 50,
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">{run.ploybookKey}</h1>
        <p className="text-sm text-zinc-600">
          Status: <span className="font-medium">{run.status}</span> · trigger: {run.triggerType} ·
          initiated by {run.initiatedBy}
        </p>
        {run.error && <p className="mt-1 text-sm text-red-700">Error: {run.error}</p>}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Steps</h2>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {s.stepOrder + 1}. {s.stepKey}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs ${stepBadge[s.status] ?? ""}`}>
                  {s.status}
                </span>
              </div>
              {s.error && <div className="mt-1 text-xs text-red-700">{s.error}</div>}
              {Object.keys((s.outputs ?? {}) as object).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                  {JSON.stringify(s.outputs, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Activity</h2>
        <ul className="space-y-1 text-xs text-zinc-600">
          {log.map((a) => (
            <li key={a.id}>
              <span className="font-mono text-zinc-400">
                {a.occurredAt.toISOString().slice(5, 19).replace("T", " ")}
              </span>{" "}
              <span className="font-medium text-zinc-800">{a.action}</span>
              {a.detail ? ` — ${a.detail}` : ""} <span className="text-zinc-400">({a.actor})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
