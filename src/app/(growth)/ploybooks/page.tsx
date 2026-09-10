import Link from "next/link";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { listPloybooks } from "@/lib/ploybooks/registry";
import { ploybookRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { launchPloybookAction, retryRunAction, resumeRunAction } from "@/app/actions";
import { PLOYBOOK_GUIDES } from "@/lib/guide";

export const dynamic = "force-dynamic";

const inputPlaceholders: Record<string, string> = {
  pb01_gc_pursuit: "GC name, e.g. Harvey Cleary",
  pb02_commercial_development: "Development name, e.g. Manvel Town Center",
  pb03_franchise_expansion: "Brand name, e.g. OAKBERRY",
  pb04_facility_portfolio: "Operator name, e.g. HCA Houston Healthcare",
  pb05_opportunity_radar: "Paste a raw signal…",
  pb06_company_swarm: "Account name (needs/discovers contacts)",
  pb07_abm_page: "Account name",
  pb08_high_intent_visitor: "Company name (visitor)",
  pb09_account_research: "Account name",
  pb10_incoming_bid: "Paste the bid invitation text…",
  pb11_bid_analyzer: "Absolute path to the bid documents folder",
  pb12_bid_qa: "Bid ID (from the PB10 run outputs)",
  pb13_bid_followup: "Bid ID (submitted bid)",
  pb14_deal_room: "Opportunity ID",
  pb15_business_case: "Opportunity ID",
  pb16_local_seo: "City × Product, e.g. Richmond × Monument Signs",
  pb17_content_builder: "A real question, e.g. channel letter cost in Houston",
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
        {defs.map((def) => {
          const guide = PLOYBOOK_GUIDES[def.key];
          return (
            <div key={def.key} className="rounded-lg border border-fog bg-white p-4">
              <div className="text-sm font-semibold">{def.name}</div>
              {guide ? (
                <p className="mt-1 text-xs text-steel">{guide.whenToUse}</p>
              ) : (
                <p className="mt-1 text-xs text-steel">{def.description}</p>
              )}
              {guide && (
                <details className="mt-2 rounded bg-cloud px-2.5 py-1.5 text-xs">
                  <summary className="cursor-pointer select-none font-medium text-ink-700">
                    How to use this
                  </summary>
                  <div className="mt-2 space-y-1.5 text-steel">
                    <p>
                      <span className="font-medium text-ink-700">Enter:</span> {guide.whatToEnter}
                    </p>
                    <p>
                      <span className="font-medium text-ink-700">What happens:</span>{" "}
                      {guide.whatHappens}
                    </p>
                    <p>
                      <span className="font-medium text-ink-700">You get:</span> {guide.whatYouGet}
                    </p>
                    {guide.caveat && <p className="text-amber-900">{guide.caveat}</p>}
                  </div>
                </details>
              )}
              <form action={launchPloybookAction} className="mt-3 flex gap-2">
                <input type="hidden" name="ploybookKey" value={def.key} />
                {inputPlaceholders[def.key] && (
                  <input
                    name="input"
                    required
                    placeholder={inputPlaceholders[def.key]}
                    className="flex-1 rounded border border-fog px-2 py-1 text-xs"
                  />
                )}
                <button className="rounded bg-signal hover:bg-signal-600 px-3 py-1.5 text-xs font-medium text-white">
                  Run now
                </button>
              </form>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent runs</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-fog text-xs text-steel">
              <th className="py-2">Ploybook</th>
              <th>Status</th>
              <th>Current step</th>
              <th>Started</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-cloud">
                <td className="py-2">
                  <Link href={`/runs/${r.id}`} className="font-medium underline">
                    {r.ploybookKey}
                  </Link>
                </td>
                <td className={statusColor[r.status] ?? "text-steel"}>{r.status}</td>
                <td className="text-steel">{r.currentStep ?? "—"}</td>
                <td className="text-steel">
                  {r.startedAt ? r.startedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td>
                  {r.status === "failed" && (
                    <form action={retryRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="rounded bg-fog px-2 py-1 text-xs">Retry</button>
                    </form>
                  )}
                  {(r.status === "running" || r.status === "queued") && (
                    <form action={resumeRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="rounded bg-fog px-2 py-1 text-xs">Resume</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {runs.length === 0 && <p className="text-sm text-steel">No runs yet.</p>}
      </section>
    </div>
  );
}
