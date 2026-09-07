import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  accounts,
  opportunities,
  ploybookRuns,
  approvals,
  activities,
} from "@/lib/db/schema";
import { count, desc, eq } from "drizzle-orm";
import { resolveApprovalAction } from "./actions";

export const dynamic = "force-dynamic";

// §15.1 Home — Growth Command Center: KPI strip, Needs You, Agents Running, activity.

export default async function Home() {
  const db = await getDb();
  const [accountCount] = await db.select({ n: count() }).from(accounts);
  const [oppCount] = await db.select({ n: count() }).from(opportunities);
  const pendingApprovals = await db.query.approvals.findMany({
    where: eq(approvals.status, "pending"),
    orderBy: desc(approvals.requestedAt),
    limit: 10,
  });
  const runningRuns = await db.query.ploybookRuns.findMany({
    where: eq(ploybookRuns.status, "running"),
    limit: 10,
  });
  const waitingRuns = await db.query.ploybookRuns.findMany({
    where: eq(ploybookRuns.status, "waiting_for_approval"),
    limit: 10,
  });
  const recentActivity = await db.query.activities.findMany({
    orderBy: desc(activities.occurredAt),
    limit: 15,
  });

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-xl font-semibold">Growth Command Center</h1>

      <section className="grid grid-cols-4 gap-4">
        {[
          { label: "Accounts", value: accountCount.n },
          { label: "Opportunities", value: oppCount.n },
          { label: "Agents running", value: runningRuns.length + waitingRuns.length },
          { label: "Needs you", value: pendingApprovals.length },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="text-2xl font-semibold">{kpi.value}</div>
            <div className="text-xs text-zinc-500">{kpi.label}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Needs you</h2>
        {pendingApprovals.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending approvals.</p>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3"
              >
                <div>
                  <div className="text-sm font-medium">{a.title}</div>
                  {a.summary && <div className="text-xs text-zinc-600">{a.summary}</div>}
                </div>
                <div className="flex gap-2">
                  <form action={resolveApprovalAction}>
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                      Approve
                    </button>
                  </form>
                  <form action={resolveApprovalAction}>
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button className="rounded bg-zinc-200 px-3 py-1 text-xs font-medium">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Agents running</h2>
        {runningRuns.length + waitingRuns.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing running. Launch one from <Link href="/ploybooks" className="underline">Ploybooks</Link>.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...runningRuns, ...waitingRuns].map((r) => (
              <li key={r.id}>
                <Link href={`/runs/${r.id}`} className="underline">
                  {r.ploybookKey}
                </Link>{" "}
                — {r.status} {r.currentStep ? `(${r.currentStep})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Recent activity</h2>
        <ul className="space-y-1 text-xs text-zinc-600">
          {recentActivity.map((a) => (
            <li key={a.id}>
              <span className="font-mono text-zinc-400">
                {a.occurredAt.toISOString().slice(5, 16).replace("T", " ")}
              </span>{" "}
              <span className="font-medium text-zinc-800">{a.action}</span>
              {a.detail ? ` — ${a.detail}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
