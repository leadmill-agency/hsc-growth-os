import { getDb } from "@/lib/db/client";
import { opportunities, projects, evidence } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { submitSignalAction, pursueOpportunityAction, pullTdlrAction } from "@/app/actions";

export const dynamic = "force-dynamic";

// §15.2 Opportunity Inbox — cards, not a cramped table: score badge, short type,
// project value, "why this matters", and a human-readable next action.

function scoreBadge(score: number | null) {
  if (score == null) return { label: "—", cls: "bg-cloud text-steel" };
  if (score >= 85) return { label: String(score), cls: "bg-signal text-white" };
  if (score >= 70) return { label: String(score), cls: "bg-ink text-white" };
  if (score >= 50) return { label: String(score), cls: "bg-amber-100 text-amber-900" };
  return { label: String(score), cls: "bg-cloud text-steel" };
}

const nextActionLabels: Record<string, string> = {
  "Launch pb01_gc_pursuit": "Pursue as GC bid",
  "Launch pb02": "Map the development",
  "Launch pb03": "Pursue franchise rollout",
  "Launch pb04": "Pursue facility portfolio",
  review: "Review",
  "Identify owner/GC first (research)": "Identify owner/GC first",
};

const sourceLabels: Record<string, string> = {
  tdlr: "TDLR filing",
  coh_co: "New CO (business moving in)",
  web_scout: "Web scout",
  manual_signal: "Pasted signal",
  website_intent: "Website visitor",
  pb01: "GC pursuit",
  pb02: "Development",
  pb03: "Franchise rollout",
  pb04: "Portfolio",
  radar: "Radar",
};

export default async function OpportunitiesPage() {
  const db = await getDb();
  const { sql } = await import("drizzle-orm");
  // Best first (per Rameel): score desc, newest breaks ties.
  const rows = await db.query.opportunities.findMany({
    orderBy: [
      desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, -1)`),
      desc(opportunities.createdAt),
    ],
    limit: 100,
  });

  const projectIds = rows.map((r) => r.projectId).filter((id): id is string => !!id);
  const projectRows = projectIds.length
    ? await db.query.projects.findMany({ where: inArray(projects.id, projectIds) })
    : [];
  const projectById = new Map(projectRows.map((p) => [p.id, p]));

  const oppIds = rows.map((r) => r.id);
  const whyRows = oppIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "opportunity"),
          eq(evidence.fieldName, "why_this_matters"),
          inArray(evidence.entityId, oppIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const whyByOpp = new Map<string, string>();
  for (const row of whyRows) {
    if (!whyByOpp.has(row.entityId)) whyByOpp.set(row.entityId, String(row.value ?? ""));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <form action={pullTdlrAction}>
          <button className="rounded border border-fog bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-signal">
            Pull filings now
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-fog bg-cloud px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold">How this works:</span> refreshed automatically every
        morning (~7am) from TDLR construction filings, Houston certificates of occupancy, and a
        web scan for franchise expansions, new developments, and multi-location operators —
        ranked best-first. Scores of 75+ research themselves and their outreach drafts land in
        Approvals. <span className="font-semibold">Pursue</span> starts that same research
        (~5 min) on anything below the line; <span className="font-semibold">the drafts never
        send without you.</span>
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
          <button className="rounded bg-signal px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-600">
            Run radar
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {rows.map((o) => {
          const badge = scoreBadge(o.overallScore ?? o.fitScore);
          const project = o.projectId ? projectById.get(o.projectId) : null;
          const projectValue = project?.estimatedProjectValue
            ? Number(project.estimatedProjectValue)
            : null;
          const why = whyByOpp.get(o.id);
          const action = o.nextAction ? (nextActionLabels[o.nextAction] ?? o.nextAction) : null;
          return (
            <div key={o.id} className="rounded-lg border border-fog bg-white p-4">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold ${badge.cls}`}
                  title="Relevance score (0–100)"
                >
                  {badge.label}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-snug">{o.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel">
                    {o.opportunityType && (
                      <span className="max-w-56 truncate rounded bg-cloud px-1.5 py-0.5" title={o.opportunityType}>
                        {o.opportunityType}
                      </span>
                    )}
                    <span className="uppercase tracking-wide">{o.stage}</span>
                    {projectValue != null && (
                      <span className="font-medium text-ink-700">
                        project ~${projectValue.toLocaleString()}
                      </span>
                    )}
                    {o.source && <span>{sourceLabels[o.source] ?? o.source}</span>}
                  </div>
                  {why && <p className="mt-2 text-sm text-ink-700">{why}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {o.stage === "discovered" && (
                    <form action={pursueOpportunityAction}>
                      <input type="hidden" name="opportunityId" value={o.id} />
                      <button className="rounded bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-600">
                        Pursue
                      </button>
                    </form>
                  )}
                  {action && <div className="text-right text-xs text-steel">{action}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-steel">
          No opportunities yet. They arrive via the daily TDLR pull, RB2B visitors, or pasted
          signals above.
        </p>
      )}
    </div>
  );
}
