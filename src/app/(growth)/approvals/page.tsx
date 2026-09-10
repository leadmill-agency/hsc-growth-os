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

// Typed, readable payload views (per Rameel 2026-09-10: "this isn't written in
// normal human language"). Raw JSON stays available behind a details toggle.

interface EmailDraft {
  subject?: string;
  body?: string;
  alternate_subject?: string;
  alternate_body?: string;
  target_contact?: string;
  rationale?: string;
}

function EmailDraftView({ draft, approveFormId }: { draft: EmailDraft; approveFormId: string }) {
  const hasAlternate = !!draft.alternate_body;
  return (
    <div className="mt-2 space-y-2">
      {draft.target_contact && (
        <p className="text-sm">
          <span className="font-medium">To:</span> {draft.target_contact}{" "}
          <span className="text-xs text-steel">— paste their verified email below to send</span>
        </p>
      )}
      <label className="block cursor-pointer rounded-lg border border-fog bg-cloud/40 p-3 has-[:checked]:border-signal">
        <div className="flex items-center gap-2 text-xs font-semibold text-ink-700">
          {hasAlternate && (
            <input type="radio" name="draftVersion" value="primary" defaultChecked form={approveFormId} />
          )}
          {hasAlternate ? "Version A" : "The email"}
        </div>
        <div className="mt-1.5 text-sm font-medium">{draft.subject}</div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{draft.body}</p>
      </label>
      {hasAlternate && (
        <label className="block cursor-pointer rounded-lg border border-fog bg-cloud/40 p-3 has-[:checked]:border-signal">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-700">
            <input type="radio" name="draftVersion" value="alternate" form={approveFormId} />
            Version B — pick one; the selected version is what sends
          </div>
          <div className="mt-1.5 text-sm font-medium">{draft.alternate_subject ?? draft.subject}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{draft.alternate_body}</p>
        </label>
      )}
      {draft.rationale && <p className="text-xs text-steel">Why written this way: {draft.rationale}</p>}
    </div>
  );
}

interface ParsedInvite {
  gc_name?: string | null;
  project_name?: string | null;
  project_address?: string | null;
  city?: string | null;
  scope_summary?: string;
  bid_due?: string | null;
  submission_method?: string | null;
  supplier_fab_items_expected?: string[];
  service_area?: string;
  unknowns?: string[];
}

const serviceAreaLabels: Record<string, string> = {
  houston_metro: "Houston metro — full service",
  texas_outside_houston: "Texas, outside the metro — canopies/awnings only",
  outside_texas: "Outside Texas — out of service area",
  unknown: "location unclear",
};

function BidInviteView({ parsed }: { parsed: ParsedInvite }) {
  const rows: [string, string | null | undefined][] = [
    ["General contractor", parsed.gc_name],
    ["Project", parsed.project_name],
    ["Where", [parsed.project_address, parsed.city].filter(Boolean).join(", ") || null],
    ["Service area", parsed.service_area ? (serviceAreaLabels[parsed.service_area] ?? parsed.service_area) : null],
    ["Bid due", parsed.bid_due ? parsed.bid_due.slice(0, 16).replace("T", " at ") : "not stated"],
    ["Submit via", parsed.submission_method ?? "not stated"],
    [
      "Supplier-fab items (awnings/canopies/backlit)",
      parsed.supplier_fab_items_expected?.length ? parsed.supplier_fab_items_expected.join(", ") : "none named",
    ],
  ];
  return (
    <div className="mt-2 space-y-1 rounded-lg border border-fog bg-cloud/40 p-3 text-sm">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <span className="font-medium">{k}:</span> <span className="text-ink-700">{v}</span>
          </div>
        ))}
      {parsed.unknowns && parsed.unknowns.length > 0 && (
        <div className="pt-1 text-xs text-steel">
          Still unknown: {parsed.unknowns.join(" · ")}
        </div>
      )}
    </div>
  );
}

function RfqListView({ rfqs }: { rfqs: { supplier_category?: string; subject?: string; body?: string }[] }) {
  return (
    <div className="mt-2 space-y-2">
      {rfqs.map((r, i) => (
        <div key={i} className="rounded-lg border border-fog bg-cloud/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-steel">
            To a {r.supplier_category ?? "supplier"}
          </div>
          <div className="mt-1 text-sm font-medium">{r.subject}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{r.body}</p>
        </div>
      ))}
    </div>
  );
}

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
            {(() => {
              const payload = (a.payload ?? {}) as {
                draft?: EmailDraft;
                parsed?: ParsedInvite;
                rfqs?: { supplier_category?: string; subject?: string; body?: string }[];
              };
              if (["send_outreach", "send_followup"].includes(a.approvalType) && payload.draft) {
                return <EmailDraftView draft={payload.draft} approveFormId={`approve-${a.id}`} />;
              }
              if (a.approvalType === "accept_bid" && payload.parsed) {
                return <BidInviteView parsed={payload.parsed} />;
              }
              if (a.approvalType === "send_supplier_rfqs" && payload.rfqs?.length) {
                return <RfqListView rfqs={payload.rfqs} />;
              }
              return null;
            })()}
            {Object.keys((a.payload ?? {}) as object).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-steel/70 hover:text-signal">
                  Raw data (for debugging)
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-cloud p-2 text-xs text-steel">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              </details>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={resolveApprovalAction} id={`approve-${a.id}`} className="flex items-center gap-2">
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
