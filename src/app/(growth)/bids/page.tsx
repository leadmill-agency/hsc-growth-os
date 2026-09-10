import { getDb } from "@/lib/db/client";
import { bids, opportunities, accounts, evidence } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  runBidQaAction,
  uploadBidPackageAction,
  startBidFromPackageAction,
  launchPloybookAction,
  recordBidOutcomeAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// Jamal's bid desk (§15.6-lite): every bid with due dates and one-click actions —
// no UUID hunting. Buttons carry the bid ID themselves.

const statusStyle: Record<string, string> = {
  invited: "bg-cloud text-steel",
  estimating: "bg-ink text-white",
  submitted: "bg-signal text-white",
  won: "bg-emerald-100 text-emerald-800",
  lost: "bg-red-100 text-red-800",
  passed: "bg-cloud text-steel",
};

// The PB11 estimator brief, rendered where Jamal works instead of buried in
// evidence records (per Rameel 2026-09-10).
interface BriefItem {
  item: string;
  description: string;
  fabrication: string;
  sheet_or_spec_refs: string[];
  quantity_note: string | null;
  confidence: number;
}
interface EstimatorBrief {
  documentsIngested?: number;
  inHouseItems: BriefItem[];
  supplierFabItems: BriefItem[];
  unclearItems: BriefItem[];
  exclusionsToState: string[];
  riskFlags: { flag: string; source_ref: string | null }[];
  rfisNeeded: string[];
  addendumChanges: string[];
  unknowns: string[];
  scopeReadVisually?: boolean;
  verificationNote: string;
}

function humanize(s: string): string {
  return s.replaceAll("_", " ");
}

function BriefItems({ title, items }: { title: string; items: BriefItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-steel">{title}</div>
      <ul className="mt-1 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{it.item}</span>
            <span className="text-steel"> — {it.description}</span>
            <div className="text-xs text-steel">
              {it.sheet_or_spec_refs.length > 0 && <>sheets: {it.sheet_or_spec_refs.join(", ")} · </>}
              qty: {it.quantity_note ?? "not stated in documents"} · confidence{" "}
              {Math.round(it.confidence * 100)}%
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BriefView({ brief, open }: { brief: EstimatorBrief; open: boolean }) {
  const itemCount =
    brief.inHouseItems.length + brief.supplierFabItems.length + brief.unclearItems.length;
  return (
    <details open={open} className="mt-3 rounded-lg border border-fog bg-cloud/50 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink-700">
        Estimator brief — {itemCount} scope item{itemCount === 1 ? "" : "s"},{" "}
        {brief.riskFlags.length} risk{brief.riskFlags.length === 1 ? "" : "s"},{" "}
        {brief.rfisNeeded.length} RFI{brief.rfisNeeded.length === 1 ? "" : "s"}
        {brief.scopeReadVisually && (
          <span className="ml-2 rounded bg-signal px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            read from drawings
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-3">
        <BriefItems title="Build in-house" items={brief.inHouseItems} />
        <BriefItems title="Buy from suppliers (RFQ)" items={brief.supplierFabItems} />
        <BriefItems title="Unclear — decide who builds" items={brief.unclearItems} />
        {brief.riskFlags.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-steel">Risks</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-700">
              {brief.riskFlags.map((r, i) => (
                <li key={i}>
                  {humanize(r.flag)}
                  {r.source_ref && <span className="text-xs text-steel"> ({r.source_ref})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {brief.rfisNeeded.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-steel">
              Ask the GC (RFIs)
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-700">
              {brief.rfisNeeded.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {brief.exclusionsToState.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-steel">
              State as excluded
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-700">
              {brief.exclusionsToState.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {brief.unknowns.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-steel">
              Still unknown
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-steel">
              {brief.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="border-t border-fog pt-2 text-xs font-medium text-amber-800">
          {brief.verificationNote}
        </p>
      </div>
    </details>
  );
}

function daysLeft(due: Date | null): { label: string; urgent: boolean } {
  if (!due) return { label: "no due date", urgent: false };
  const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: `${-days}d overdue`, urgent: true };
  if (days === 0) return { label: "due today", urgent: true };
  return { label: `${days}d left`, urgent: days <= 3 };
}

export default async function BidsPage() {
  const db = await getDb();
  const rows = await db.query.bids.findMany({ orderBy: desc(bids.createdAt), limit: 50 });
  const oppIds = rows.map((b) => b.opportunityId).filter((id): id is string => !!id);
  const opps = oppIds.length
    ? await db.query.opportunities.findMany({ where: inArray(opportunities.id, oppIds) })
    : [];
  const oppById = new Map(opps.map((o) => [o.id, o]));
  const accountIds = opps.map((o) => o.accountId).filter((id): id is string => !!id);
  const accts = accountIds.length
    ? await db.query.accounts.findMany({ where: inArray(accounts.id, accountIds) })
    : [];
  const accountById = new Map(accts.map((a) => [a.id, a]));

  const bidIds = rows.map((b) => b.id);
  const briefRows = bidIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "bid"),
          eq(evidence.fieldName, "estimator_brief"),
          inArray(evidence.entityId, bidIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const briefByBid = new Map<string, EstimatorBrief>();
  for (const row of briefRows) {
    if (!briefByBid.has(row.entityId)) briefByBid.set(row.entityId, row.value as EstimatorBrief);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Bids</h1>
      <p className="text-sm text-steel">
        Every tracked bid, with two ways to start one below. Once a bid is marked submitted,
        Day-2/7/14/30 follow-ups draft themselves automatically.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <form
          action={startBidFromPackageAction}
          className="space-y-2 rounded-lg border border-fog bg-white p-4"
        >
          <div className="text-sm font-semibold">Upload a bid package (.zip)</div>
          <p className="text-xs text-steel">
            Drop the plans/specs zip from PlanHub or a GC email. The analyzer reads every
            document and builds the estimator brief: sign scope, quantities, due dates, and
            what&apos;s missing.
          </p>
          <input
            name="projectName"
            required
            placeholder="Project name (e.g. Katy Grand Retail Phase 2)"
            className="w-full rounded border border-fog px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-steel">
              Due
              <input type="date" name="dueDate" className="rounded border border-fog px-2 py-1 text-xs" />
            </label>
            <input
              type="file"
              name="package"
              accept=".zip"
              required
              className="min-w-0 flex-1 text-xs text-steel file:mr-2 file:rounded file:border-0 file:bg-cloud file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink-700"
            />
          </div>
          <button className="rounded bg-signal px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-600">
            Upload + analyze
          </button>
        </form>

        <form
          action={launchPloybookAction}
          className="space-y-2 rounded-lg border border-fog bg-white p-4"
        >
          <input type="hidden" name="ploybookKey" value="pb10_incoming_bid" />
          <div className="text-sm font-semibold">Paste a bid invite</div>
          <p className="text-xs text-steel">
            Paste the invite email or PlanHub notice. The system extracts the GC, project, scope,
            and due date, creates the bid card, and drafts the acknowledgment.
          </p>
          <textarea
            name="input"
            required
            rows={4}
            placeholder="Paste the full invitation text here…"
            className="w-full rounded border border-fog px-2 py-1 text-sm"
          />
          <button className="rounded bg-signal px-3 py-1.5 text-sm font-medium text-white hover:bg-signal-600">
            Create bid from invite
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {rows.map((bid) => {
          const opp = bid.opportunityId ? oppById.get(bid.opportunityId) : null;
          const account = opp?.accountId ? accountById.get(opp.accountId) : null;
          const due = daysLeft(bid.dueAt);
          const active = !["won", "lost", "passed", "cancelled"].includes(bid.status);
          const brief = briefByBid.get(bid.id);
          return (
            <div key={bid.id} className="rounded-lg border border-fog bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold leading-snug">{opp?.name ?? "Untracked bid"}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${statusStyle[bid.status] ?? "bg-cloud"}`}>
                      {bid.status}
                    </span>
                    {account && <span>{account.name}</span>}
                    {bid.dueAt && (
                      <span className={due.urgent ? "font-semibold text-red-700" : ""}>
                        due {bid.dueAt.toISOString().slice(0, 10)} ({due.label})
                      </span>
                    )}
                    {bid.submittedAt && <span>submitted {bid.submittedAt.toISOString().slice(0, 10)}</span>}
                  </div>
                  {bid.notes && <p className="mt-1 text-xs text-steel">{bid.notes}</p>}
                </div>
                {active && (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <form action={runBidQaAction}>
                      <input type="hidden" name="bidId" value={bid.id} />
                      <button className="rounded bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-600">
                        Run QA checklist
                      </button>
                    </form>
                    {bid.status !== "submitted" && (
                      <form action={uploadBidPackageAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="bidId" value={bid.id} />
                        <input
                          type="file"
                          name="package"
                          accept=".zip"
                          required
                          className="w-52 text-xs text-steel file:mr-2 file:rounded file:border-0 file:bg-cloud file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink-700"
                        />
                        <button className="rounded border border-fog bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                          Upload + analyze
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {brief && <BriefView brief={brief} open={bid.status === "estimating"} />}

              {/* Record what actually happened — "submitted" starts the Day-2/7/14/30
                  follow-ups, won/lost close the loop (and cancel pending follow-ups). */}
              {active && bid.status !== "submitted" && (
                <form
                  action={recordBidOutcomeAction}
                  className="mt-3 flex items-center gap-2 border-t border-cloud pt-3"
                >
                  <input type="hidden" name="bidId" value={bid.id} />
                  <input type="hidden" name="outcome" value="submitted" />
                  <button className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                    Mark submitted
                  </button>
                  <span className="text-[11px] text-steel">
                    submitted the proposal in PlanHub or by email? Click this — it starts the
                    automatic follow-up cadence
                  </span>
                </form>
              )}
              {bid.status === "submitted" && (
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-cloud pt-3">
                  <form action={recordBidOutcomeAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="bidId" value={bid.id} />
                    <input type="hidden" name="outcome" value="won" />
                    <input
                      name="awardAmount"
                      placeholder="Award $ (optional)"
                      className="w-32 rounded border border-fog px-2 py-1 text-xs"
                    />
                    <button className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                      We won
                    </button>
                  </form>
                  <form action={recordBidOutcomeAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="bidId" value={bid.id} />
                    <input type="hidden" name="outcome" value="lost" />
                    <input
                      name="lossReason"
                      placeholder="Why lost? (optional)"
                      className="w-44 rounded border border-fog px-2 py-1 text-xs"
                    />
                    <button className="rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                      We lost
                    </button>
                  </form>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-steel">No bids yet. Paste a bid invitation into PB10 on the Ploybooks page.</p>
      )}
    </div>
  );
}
