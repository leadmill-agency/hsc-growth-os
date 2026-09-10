import { getDb } from "@/lib/db/client";
import { opportunities, projects, evidence, contacts } from "@/lib/db/schema";
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

// Label + what actually happens if you hit Pursue on it (shown as a tooltip —
// "Review" vs "Map the development" was opaque, per Rameel 2026-09-10).
const nextActionLabels: Record<string, { label: string; help: string }> = {
  "Launch pb01_gc_pursuit": {
    label: "Pursue as GC bid",
    help: "Radar thinks a GC is taking bids here. Pursue researches the GC and drafts an intro email for your approval.",
  },
  "Launch pb02": {
    label: "Map the development",
    help: "Radar spotted a multi-tenant development. Pursue breaks it into every individual sign opportunity (tenants, monument, wayfinding).",
  },
  "Launch pb03": {
    label: "Pursue franchise rollout",
    help: "Radar spotted a franchise expanding. Pursue researches their Texas rollout and drafts outreach to the franchising team.",
  },
  "Launch pb04": {
    label: "Pursue facility portfolio",
    help: "Radar spotted a multi-location operator. Pursue maps their locations and drafts a portfolio pitch.",
  },
  review: {
    label: "Needs your read",
    help: "The radar wasn't confident what this is — open the original signal below and decide. Pursue still works: it researches the owner first.",
  },
  "Identify owner/GC first (research)": {
    label: "Identify owner/GC first",
    help: "Nobody is named on this filing yet. Pursue starts by finding out who owns the project before any outreach.",
  },
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

// Filter chips (per Rameel 2026-09-10): one per signal source.
const sourceFilters: { key: string; label: string; sources: string[] }[] = [
  { key: "tdlr", label: "TDLR filings", sources: ["tdlr"] },
  { key: "coh", label: "New COs", sources: ["coh_co"] },
  { key: "web", label: "Web scout", sources: ["web_scout"] },
  { key: "other", label: "Other", sources: [] }, // everything not in the lists above
];
const knownSources = sourceFilters.flatMap((f) => f.sources);

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const { source: activeFilter } = await searchParams;
  const db = await getDb();
  const { sql, notInArray } = await import("drizzle-orm");
  const filter = sourceFilters.find((f) => f.key === activeFilter);
  const where = filter
    ? filter.sources.length
      ? inArray(opportunities.source, filter.sources)
      : notInArray(sql`coalesce(${opportunities.source}, '')`, knownSources)
    : undefined;
  // Best first (per Rameel): score desc, newest breaks ties.
  const rows = await db.query.opportunities.findMany({
    where,
    orderBy: [
      desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, -1)`),
      desc(opportunities.createdAt),
    ],
    limit: 100,
  });
  const sourceCounts = await db
    .select({ source: opportunities.source, n: sql<number>`count(*)::int` })
    .from(opportunities)
    .groupBy(opportunities.source);
  const countFor = (f: (typeof sourceFilters)[number]) =>
    sourceCounts
      .filter((r) =>
        f.sources.length ? f.sources.includes(r.source ?? "") : !knownSources.includes(r.source ?? "")
      )
      .reduce((sum, r) => sum + r.n, 0);
  const totalCount = sourceCounts.reduce((sum, r) => sum + r.n, 0);

  const projectIds = rows.map((r) => r.projectId).filter((id): id is string => !!id);
  const projectRows = projectIds.length
    ? await db.query.projects.findMany({ where: inArray(projects.id, projectIds) })
    : [];
  const projectById = new Map(projectRows.map((p) => [p.id, p]));

  const oppIds = rows.map((r) => r.id);
  const evidenceRows = oppIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "opportunity"),
          inArray(evidence.fieldName, ["why_this_matters", "origin_signal"]),
          inArray(evidence.entityId, oppIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const whyByOpp = new Map<string, string>();
  const signalByOpp = new Map<string, string>();
  for (const row of evidenceRows) {
    const target = row.fieldName === "why_this_matters" ? whyByOpp : signalByOpp;
    if (!target.has(row.entityId)) target.set(row.entityId, String(row.value ?? ""));
  }

  // Best-known person to talk to, per account (research/swarm fill these in).
  const accountIds = [...new Set(rows.map((r) => r.accountId).filter((id): id is string => !!id))];
  const contactRows = accountIds.length
    ? await db.query.contacts.findMany({ where: inArray(contacts.accountId, accountIds) })
    : [];
  const contactByAccount = new Map<string, (typeof contactRows)[number]>();
  for (const c of contactRows) {
    if (c.accountId && !contactByAccount.has(c.accountId)) contactByAccount.set(c.accountId, c);
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
        morning (~7am) from TDLR construction filings (39 counties, ~150 mi around Houston),
        Houston certificates of occupancy, and a web scan for franchise expansions, new
        developments, and multi-location operators — ranked best-first. Scores of 75+ research
        themselves, best-first up to a daily budget (currently 25); their outreach drafts land
        in Approvals. <span className="font-semibold">Pursue</span> starts that same research
        (~5 min) on anything the budget didn&apos;t reach;{" "}
        <span className="font-semibold">the drafts never send without you.</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <a
          href="/opportunities"
          className={`rounded-full border px-3 py-1 font-medium ${!filter ? "border-signal bg-signal text-white" : "border-fog bg-white text-ink-700 hover:border-signal"}`}
        >
          All ({totalCount})
        </a>
        {sourceFilters.map((f) => (
          <a
            key={f.key}
            href={`/opportunities?source=${f.key}`}
            className={`rounded-full border px-3 py-1 font-medium ${filter?.key === f.key ? "border-signal bg-signal text-white" : "border-fog bg-white text-ink-700 hover:border-signal"}`}
          >
            {f.label} ({countFor(f)})
          </a>
        ))}
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
          const signal = signalByOpp.get(o.id);
          const contact = o.accountId ? contactByAccount.get(o.accountId) : null;
          const address = [project?.address, project?.city].filter(Boolean).join(", ");
          const sourceLink =
            o.sourceDetail && /^https?:\/\//.test(o.sourceDetail) ? o.sourceDetail : null;
          const action = o.nextAction
            ? (nextActionLabels[o.nextAction] ?? { label: o.nextAction, help: "" })
            : null;
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
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-steel">
                    {address && <span title="Project address">📍 {address}</span>}
                    <span title="Where this came from">
                      Found via {sourceLabels[o.source ?? ""] ?? o.source ?? "unknown"}
                      {o.createdAt && ` on ${o.createdAt.toISOString().slice(0, 10)}`}
                      {sourceLink && (
                        <>
                          {" · "}
                          <a href={sourceLink} target="_blank" className="underline hover:text-signal">
                            view source
                          </a>
                        </>
                      )}
                    </span>
                    {contact ? (
                      <span title="Best known contact (found by research)">
                        👤 {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                        {contact.title ? `, ${contact.title}` : ""}
                        {contact.email ? ` · ${contact.email}` : ""}
                      </span>
                    ) : (
                      <span className="text-steel/70" title="Research and Pursue find the decision-makers">
                        👤 no contact yet — Pursue finds one
                      </span>
                    )}
                  </div>
                  {why && <p className="mt-2 text-sm text-ink-700">{why}</p>}
                  {signal && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-steel hover:text-signal">
                        View the original signal
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-cloud p-2 font-sans text-xs text-ink-700">
                        {signal}
                      </pre>
                    </details>
                  )}
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
                  {action && (
                    <div
                      className="max-w-40 cursor-help text-right text-xs text-steel underline decoration-dotted underline-offset-2"
                      title={action.help}
                    >
                      {action.label}
                    </div>
                  )}
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
