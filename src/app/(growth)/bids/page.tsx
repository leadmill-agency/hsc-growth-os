import { getDb } from "@/lib/db/client";
import { bids, opportunities, accounts } from "@/lib/db/schema";
import { desc, inArray } from "drizzle-orm";
import { runBidQaAction, analyzeBidAction } from "@/app/actions";

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
        Every tracked bid. New ones arrive via PB10 (paste an invite on the Ploybooks page).
        Follow-ups start automatically once a bid is recorded as submitted.
      </p>

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
                      <form action={analyzeBidAction} className="flex items-center gap-1.5">
                        <input type="hidden" name="bidId" value={bid.id} />
                        <input
                          name="folderPath"
                          placeholder="Docs folder path (on the server)"
                          className="w-52 rounded border border-fog px-2 py-1 text-xs"
                        />
                        <button className="rounded border border-fog bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                          Analyze
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
