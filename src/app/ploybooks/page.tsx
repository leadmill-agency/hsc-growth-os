import Link from "next/link";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { listPloybooks } from "@/lib/ploybooks/registry";
import { ploybookRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { launchPloybookAction, retryRunAction, resumeRunAction } from "../actions";

export const dynamic = "force-dynamic";

const inputPlaceholders: Record<string, string> = {
  pb01_gc_pursuit: "GC name, e.g. Harvey Cleary",
  pb02_commercial_development: "Development name, e.g. Manvel Town Center",
  pb03_franchise_expansion: "Brand name, e.g. OAKBERRY",
  pb04_facility_portfolio: "Operator name, e.g. HCA Houston Healthcare",
  pb05_opportunity_radar: "Paste a raw signal…",
  pb09_account_research: "Account name",
};

const statusColor: Record<string, string> = {
  completed: "text-emerald-700",
  failed: "text-red-700",
  waiting_for_approval: "text-amber-700",
  running: "text-blue-700",
};

export default async function PloybooksPage() {
  const db = await getDb();
  const defs = listPloybooks();
  const runs = await db.query.ploybookRuns.findMany({
    orderBy: desc(ploybookRuns.createdAt),
    limit: 25,
  });

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold">Ploybooks</h1>

      <section className="grid grid-cols-2 gap-4">
        {defs.map((def) => (
          <div key={def.key} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-sm font-semibold">{def.name}</div>
            <p className="mt-1 text-xs text-zinc-600">{def.description}</p>
            <div className="mt-2 text-xs text-zinc-400">
              {def.steps.length} steps · v{def.version}
            </div>
            <form action={launchPloybookAction} className="mt-3 flex gap-2">
              <input type="hidden" name="ploybookKey" value={def.key} />
              {inputPlaceholders[def.key] && (
                <input
                  name="input"
                  required
                  placeholder={inputPlaceholders[def.key]}
                  className="flex-1 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              )}
              <button className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                Run now
              </button>
            </form>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Recent runs</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500">
              <th className="py-2">Ploybook</th>
              <th>Status</th>
              <th>Current step</th>
              <th>Started</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="py-2">
                  <Link href={`/runs/${r.id}`} className="font-medium underline">
                    {r.ploybookKey}
                  </Link>
                </td>
                <td className={statusColor[r.status] ?? "text-zinc-600"}>{r.status}</td>
                <td className="text-zinc-600">{r.currentStep ?? "—"}</td>
                <td className="text-zinc-600">
                  {r.startedAt ? r.startedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td>
                  {r.status === "failed" && (
                    <form action={retryRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="rounded bg-zinc-200 px-2 py-1 text-xs">Retry</button>
                    </form>
                  )}
                  {(r.status === "running" || r.status === "queued") && (
                    <form action={resumeRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="rounded bg-zinc-200 px-2 py-1 text-xs">Resume</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && <p className="text-sm text-zinc-500">No runs yet.</p>}
      </section>
    </div>
  );
}
