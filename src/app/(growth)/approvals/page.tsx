import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { approvals, ploybookRuns, opportunities } from "@/lib/db/schema";
import { desc, eq, inArray, ne } from "drizzle-orm";
import { resolveApprovalAction } from "@/app/actions";
import { PLOYBOOK_GUIDES } from "@/lib/guide";

export const dynamic = "force-dynamic";

// §15.9 — one approval inbox for everything.

// Rejection codes (per Rameel 2026-09-10): a pass should say why, so patterns
// ("everything from X is too far") become visible instead of anecdotal.
const rejectionCodes: [string, string][] = [
  ["too_far", "Too far away"],
  ["no_sign_scope", "No sign/canopy scope"],
  ["too_small", "Job too small"],
  ["low_margin", "Margin too thin"],
  ["no_capacity", "No bandwidth right now"],
  ["wrong_fit", "Not our kind of work/GC"],
  ["draft_wrong", "Draft is wrong — needs redo"],
  ["other", "Other"],
];
const rejectionLabel = new Map(rejectionCodes);

// Where a card came from (per Rameel 2026-09-10: "how did this one show up?").
const triggerLabels: Record<string, string> = {
  manual: "run by the team",
  scheduled: "the daily automatic run",
  "event:auto_pursue": "auto-pursued — scored above the research line",
  "webhook:inbound_email": "a forwarded email (PlanHub/Gmail intake)",
  "webhook:rb2b": "a website visitor identification",
  "event:bid.submitted": "the follow-up cadence after a bid was submitted",
  ploybook: "launched by another playbook",
};

const sourceLabels: Record<string, string> = {
  tdlr: "a TDLR construction filing",
  coh_co: "a new certificate of occupancy",
  web_scout: "the daily web scan",
  manual_signal: "a pasted signal",
  email_inbound: "a forwarded bid invite",
  bid_invite: "a bid invitation",
  bid_package: "an uploaded bid package",
};

export default async function ApprovalsPage() {
  const db = await getDb();
  const pending = await db.query.approvals.findMany({
    where: eq(approvals.status, "pending"),
    orderBy: desc(approvals.requestedAt),
  });
  const resolved = await db.query.approvals.findMany({
    where: ne(approvals.status, "pending"),
    orderBy: desc(approvals.requestedAt),
    limit: 20,
  });

  // Provenance: the run that asked for this approval + the opportunity behind it.
  const runIds = pending.map((a) => a.runId).filter((id): id is string => !!id);
  const runs = runIds.length
    ? await db.query.ploybookRuns.findMany({ where: inArray(ploybookRuns.id, runIds) })
    : [];
  const runById = new Map(runs.map((r) => [r.id, r]));
  const oppIds = [
    ...new Set(
      pending
        .map((a) => ((a.payload ?? {}) as { opportunityId?: string }).opportunityId)
        .filter((id): id is string => !!id)
    ),
  ];
  const opps = oppIds.length
    ? await db.query.opportunities.findMany({ where: inArray(opportunities.id, oppIds) })
    : [];
  const oppById = new Map(opps.map((o) => [o.id, o]));

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Approvals</h1>

      <section className="space-y-3">
        {pending.length === 0 && <p className="text-sm text-steel">Nothing pending.</p>}
        {pending.map((a) => {
          const run = a.runId ? runById.get(a.runId) : null;
          const opp = oppById.get(((a.payload ?? {}) as { opportunityId?: string }).opportunityId ?? "");
          return (
          <div key={a.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-steel/70">{a.approvalType}</div>
            <div className="mt-1 text-sm font-semibold">{a.title}</div>
            {run && (
              <p className="mt-1 text-xs text-steel">
                <span className="font-medium text-ink-700">Where this came from:</span>{" "}
                &ldquo;{PLOYBOOK_GUIDES[run.ploybookKey]?.title ?? run.ploybookKey}&rdquo; via{" "}
                {triggerLabels[run.triggerType] ?? run.triggerType} on{" "}
                {run.createdAt.toISOString().slice(0, 10)}
                {opp?.source && <> · originally found through {sourceLabels[opp.source] ?? opp.source}</>}
                {opp && (
                  <>
                    {" "}
                    · <Link href="/opportunities" className="underline hover:text-signal">{opp.name}</Link>
                  </>
                )}{" "}
                · <Link href={`/runs/${run.id}`} className="underline hover:text-signal">see the full run</Link>
              </p>
            )}
            {a.summary && <p className="mt-1 text-sm text-steel">{a.summary}</p>}
            {a.proposedAction && (
              <p className="mt-1 text-sm text-steel">
                <span className="font-medium">Proposed:</span> {a.proposedAction}
              </p>
            )}
            {Object.keys((a.payload ?? {}) as object).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded bg-cloud p-2 text-xs text-steel">
                {JSON.stringify(a.payload, null, 2)}
              </pre>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={resolveApprovalAction} className="flex items-center gap-2">
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="decision" value="approved" />
                {["send_outreach", "send_followup"].includes(a.approvalType) && (
                  <input
                    name="recipientEmail"
                    type="email"
                    placeholder="Recipient email (verified) — sends on approve"
                    className="w-72 rounded border border-fog px-2 py-1 text-xs"
                  />
                )}
                <button className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
                  {["send_outreach", "send_followup"].includes(a.approvalType)
                    ? "Approve (+ send if email given)"
                    : "Approve"}
                </button>
              </form>
              <form action={resolveApprovalAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="decision" value="rejected" />
                <select
                  name="rejectionCode"
                  defaultValue=""
                  className="rounded border border-fog px-2 py-1 text-xs text-ink-700"
                >
                  <option value="">Why reject? (optional)</option>
                  {rejectionCodes.map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  name="rejectionNote"
                  placeholder="Note (optional)"
                  className="w-44 rounded border border-fog px-2 py-1 text-xs"
                />
                <button className="rounded bg-fog px-3 py-1.5 text-xs font-medium">
                  Reject
                </button>
              </form>
            </div>
          </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recently resolved</h2>
        <ul className="space-y-1 text-sm text-steel">
          {resolved.map((a) => {
            const res = (a.resolutionPayload ?? {}) as { rejectionCode?: string; rejectionNote?: string };
            return (
              <li key={a.id}>
                {a.title} — <span className="font-medium">{a.status}</span>
                {a.resolvedBy ? ` by ${a.resolvedBy}` : ""}
                {res.rejectionCode && (
                  <span className="text-steel/80">
                    {" "}
                    ({rejectionLabel.get(res.rejectionCode) ?? res.rejectionCode}
                    {res.rejectionNote ? ` — ${res.rejectionNote}` : ""})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
