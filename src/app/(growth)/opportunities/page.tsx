import { getDb } from "@/lib/db/client";
import { opportunities } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { submitSignalAction, pursueOpportunityAction, pullTdlrAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const db = await getDb();
  const rows = await db.query.opportunities.findMany({
    orderBy: desc(opportunities.createdAt),
    limit: 100,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <form action={pullTdlrAction}>
          <button className="rounded border border-fog bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-signal">
            Pull TDLR filings now
          </button>
        </form>
      </div>

      <form
        action={submitSignalAction}
        className="space-y-2 rounded-lg border border-fog bg-white p-4"
      >
        <div className="text-sm font-semibold">Add signal (PB05 Opportunity Radar)</div>
        <p className="text-xs text-steel">
          Paste a bid notice, permit line, news blurb, PlanHub invite, or forwarded email. The
          radar classifies it, dedupes, scores it, and suggests the next ploybook.
        </p>
        <textarea
          name="signalText"
          required
          rows={3}
          placeholder="e.g. Harvey Cleary soliciting subs for UH Engineering Building, scope includes exterior signage…"
          className="w-full rounded border border-fog px-2 py-1 text-sm"
        />
        <div className="flex items-center gap-3">
          <input
            name="sourceUrl"
            placeholder="Source URL (optional)"
            className="flex-1 rounded border border-fog px-2 py-1 text-sm"
          />
          <button className="rounded bg-signal hover:bg-signal-600 px-3 py-1.5 text-sm font-medium text-white">
            Run radar
          </button>
        </div>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-fog text-xs text-steel">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th>Stage</th>
            <th>Score</th>
            <th>Est. value</th>
            <th>Source</th>
            <th>Next action</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-cloud">
              <td className="py-2 font-medium">{o.name}</td>
              <td className="text-steel">{o.opportunityType ?? "—"}</td>
              <td className="text-steel">{o.stage}</td>
              <td>{o.overallScore ?? o.fitScore ?? "—"}</td>
              <td>{o.estimatedValue ? `$${Number(o.estimatedValue).toLocaleString()}` : "—"}</td>
              <td className="text-steel">{o.source ?? "—"}</td>
              <td className="text-steel">{o.nextAction ?? "—"}</td>
              <td>
                {o.stage === "discovered" && (
                  <form action={pursueOpportunityAction}>
                    <input type="hidden" name="opportunityId" value={o.id} />
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">
                      Pursue
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-sm text-steel">
          No opportunities yet. They arrive via Ploybooks (PB05 Opportunity Radar) or manual entry.
        </p>
      )}
    </div>
  );
}
