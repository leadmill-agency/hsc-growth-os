import { getDb } from "@/lib/db/client";
import { SubmitButton } from "@/app/(growth)/submit-button";
import { DISMISS_REASONS } from "@/lib/dismiss-reasons";
import { opportunities, evidence } from "@/lib/db/schema";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  pursueOpportunityAction,
  pullTdlrAction,
  setOpportunityStageAction,
  pinOpportunityAction,
} from "@/app/actions";
import { ONE_OFF_TTL_MS } from "@/lib/actions/archive-sweep";

export const dynamic = "force-dynamic";

// The triage inbox as ONE COMPACT TABLE (Rameel 2026-09-21): this portal hunts
// enterprise contracts, so rollouts (franchise/multi-unit/development) are the
// default tab, one-off projects sit on the side and auto-archive after 7 idle
// days (Keep pins one), and bid invites have their own tab. Rich cards only
// exist AFTER Pursue — in Researched.

function scoreCls(score: number | null) {
  if (score == null) return "text-steel";
  if (score >= 85) return "text-signal font-semibold";
  if (score >= 70) return "text-ink font-semibold";
  return "text-steel";
}

const sourceShort: Record<string, string> = {
  tdlr: "TDLR",
  coh_co: "New CO",
  web_scout: "Web scout",
  manual_signal: "Pasted",
  website_intent: "Website visitor",
  email_inbound: "Bid email",
  planhub: "PlanHub",
};

const TABS = [
  { key: "rollouts", label: "Rollouts" },
  { key: "oneoffs", label: "One-off projects" },
  { key: "bids", label: "Bid invites" },
] as const;

function daysAgo(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1d ago" : `${days}d ago`;
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? (tabParam as string) : "rollouts";
  const db = await getDb();
  const { sql } = await import("drizzle-orm");

  const isRollout = eq(opportunities.scale, "rollout");
  const isOneOff = or(eq(opportunities.scale, "one_off"), isNull(opportunities.scale))!;
  const tabWhere =
    tab === "bids"
      ? eq(opportunities.stage, "bid_invited")
      : tab === "rollouts"
        ? and(eq(opportunities.stage, "discovered"), isRollout)!
        : and(eq(opportunities.stage, "discovered"), isOneOff)!;

  const rows = await db.query.opportunities.findMany({
    where: tabWhere,
    orderBy: [
      desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, -1)`),
      desc(opportunities.createdAt),
    ],
    limit: 150,
  });

  const [rolloutCount, oneOffCount, bidCount] = await Promise.all([
    db.$count(opportunities, and(eq(opportunities.stage, "discovered"), isRollout)!),
    db.$count(opportunities, and(eq(opportunities.stage, "discovered"), isOneOff)!),
    db.$count(opportunities, eq(opportunities.stage, "bid_invited")),
  ]);
  const counts: Record<string, number> = {
    rollouts: rolloutCount,
    oneoffs: oneOffCount,
    bids: bidCount,
  };

  // One-line context per row: the radar's "why this matters" as a tooltip.
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
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <form action={pullTdlrAction}>
          <SubmitButton className="rounded border border-fog bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-signal">
            Pull filings now
          </SubmitButton>
        </form>
      </div>

      <div className="rounded-lg border border-fog bg-cloud px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold">How this works:</span> refreshed every morning from
        TDLR filings, Houston COs, a web scan aimed at franchise and rollout news, and
        forwarded PlanHub invites. <span className="font-semibold">Rollouts</span> are the
        enterprise targets — franchises, multi-unit operators, developments — and stay until
        you decide. <span className="font-semibold">One-off projects</span> quietly archive
        after 7 idle days (Keep holds one; a new signal resurfaces an archived card).{" "}
        <span className="font-semibold">Pursue</span> researches a company (~5 min) and builds
        its card in Researched. Nothing researches by itself.
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {TABS.map((t) => (
          <a
            key={t.key}
            href={`/opportunities?tab=${t.key}`}
            className={`rounded-full border px-3 py-1 font-medium ${tab === t.key ? "border-signal bg-signal text-white" : "border-fog bg-white text-ink-700 hover:border-signal"}`}
          >
            {t.label} ({counts[t.key]})
          </a>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-fog bg-white">
        {rows.map((o) => {
          const idleMs = Date.now() - o.updatedAt.getTime();
          const daysLeft = Math.max(0, Math.ceil((ONE_OFF_TTL_MS - idleMs) / 86400000));
          const expiring = tab === "oneoffs" && !o.pinned && daysLeft <= 2;
          const isBid = ["incoming_bid", "bid"].includes(o.opportunityType ?? "") || o.stage === "bid_invited";
          return (
            <div
              key={o.id}
              className="flex items-center gap-3 border-b border-cloud px-3 py-2 text-sm last:border-b-0 hover:bg-cloud/40"
            >
              <span className={`w-7 shrink-0 text-right tabular-nums ${scoreCls(o.overallScore ?? o.fitScore)}`}>
                {o.overallScore ?? o.fitScore ?? "—"}
              </span>
              <span
                className="min-w-0 flex-1 truncate"
                title={whyByOpp.get(o.id) || o.nextAction || undefined}
              >
                {o.pinned && (
                  <span className="mr-1 text-[10px] uppercase tracking-wide text-signal" title="Kept — never archives">
                    kept
                  </span>
                )}
                {o.name}
                {o.sourceDetail && (
                  <a
                    href={o.sourceDetail}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-steel underline decoration-dotted hover:text-signal"
                  >
                    source
                  </a>
                )}
              </span>
              <span className="hidden w-40 shrink-0 text-right text-xs text-steel sm:block">
                {sourceShort[o.source ?? ""] ?? o.source ?? "—"} · {daysAgo(o.createdAt)}
              </span>
              {expiring && (
                <span className="shrink-0 text-xs text-amber-700" title="One-off cards untouched for 7 days archive automatically">
                  archives in {daysLeft === 0 ? "<1" : daysLeft}d
                </span>
              )}
              {expiring && (
                <form action={pinOpportunityAction} className="shrink-0">
                  <input type="hidden" name="opportunityId" value={o.id} />
                  <SubmitButton className="rounded border border-fog bg-white px-2 py-0.5 text-[11px] font-medium text-ink-700 hover:border-signal">
                    Keep
                  </SubmitButton>
                </form>
              )}
              <form action={pursueOpportunityAction} className="shrink-0">
                <input type="hidden" name="opportunityId" value={o.id} />
                <SubmitButton
                  className="rounded bg-signal px-2.5 py-1 text-xs font-medium text-white hover:bg-signal-600"
                  title={
                    isBid
                      ? "We're bidding this — moves it to the bid desk in Researched"
                      : "Research this company (~5 min) — builds its card in Researched"
                  }
                >
                  {isBid ? "Bid this" : "Pursue"}
                </SubmitButton>
              </form>
              <form action={setOpportunityStageAction} className="flex shrink-0 items-center gap-1">
                <input type="hidden" name="opportunityId" value={o.id} />
                <input type="hidden" name="stage" value="dismissed" />
                <select
                  name="dismissReason"
                  required
                  defaultValue=""
                  className="w-28 rounded border border-fog bg-white px-1 py-0.5 text-[11px] text-steel"
                  title="Required — every dismissal teaches the radar what to score lower"
                >
                  <option value="" disabled>
                    Why dismiss?
                  </option>
                  {DISMISS_REASONS.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  name="dismissNote"
                  placeholder="Note"
                  className="hidden w-24 rounded border border-fog px-1.5 py-0.5 text-[11px] md:block"
                  title="Required if the reason is Other"
                />
                <SubmitButton
                  className="rounded border border-fog bg-white px-2 py-0.5 text-[11px] font-medium text-steel hover:border-signal"
                  title="Not relevant — reason required; picking Other needs the note"
                >
                  Dismiss
                </SubmitButton>
              </form>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="px-4 py-6 text-sm text-steel">
            {tab === "rollouts"
              ? "No rollout targets right now — the morning scan hunts franchise and multi-unit news daily."
              : tab === "bids"
                ? "No open bid invites."
                : "No one-off projects waiting."}
          </p>
        )}
      </div>
    </div>
  );
}
