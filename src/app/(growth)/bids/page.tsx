import { getDb } from "@/lib/db/client";
import { bids, opportunities, accounts } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import {
  runBidQaAction,
  uploadBidPackageAction,
  startBidFromPackageAction,
  launchPloybookAction,
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
