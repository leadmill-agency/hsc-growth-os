import { getDb } from "@/lib/db/client";
import { opportunities } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const db = await getDb();
  const rows = await db.query.opportunities.findMany({
    orderBy: desc(opportunities.createdAt),
    limit: 100,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Opportunities</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th>Stage</th>
            <th>Score</th>
            <th>Est. value</th>
            <th>Source</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-zinc-100">
              <td className="py-2 font-medium">{o.name}</td>
              <td className="text-zinc-600">{o.opportunityType ?? "—"}</td>
              <td className="text-zinc-600">{o.stage}</td>
              <td>{o.overallScore ?? o.fitScore ?? "—"}</td>
              <td>{o.estimatedValue ? `$${Number(o.estimatedValue).toLocaleString()}` : "—"}</td>
              <td className="text-zinc-600">{o.source ?? "—"}</td>
              <td className="text-zinc-600">{o.nextAction ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-sm text-zinc-500">
          No opportunities yet. They arrive via Ploybooks (PB05 Opportunity Radar) or manual entry.
        </p>
      )}
    </div>
  );
}
