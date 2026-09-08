import { getDb } from "@/lib/db/client";
import { approvals } from "@/lib/db/schema";
import { desc, eq, ne } from "drizzle-orm";
import { resolveApprovalAction } from "@/app/actions";

export const dynamic = "force-dynamic";

// §15.9 — one approval inbox for everything.

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

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Approvals</h1>

      <section className="space-y-3">
        {pending.length === 0 && <p className="text-sm text-zinc-500">Nothing pending.</p>}
        {pending.map((a) => (
          <div key={a.id} className="rounded-lg border border-amber-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-400">{a.approvalType}</div>
            <div className="mt-1 text-sm font-semibold">{a.title}</div>
            {a.summary && <p className="mt-1 text-sm text-zinc-600">{a.summary}</p>}
            {a.proposedAction && (
              <p className="mt-1 text-sm text-zinc-600">
                <span className="font-medium">Proposed:</span> {a.proposedAction}
              </p>
            )}
            {Object.keys((a.payload ?? {}) as object).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-2 text-xs text-zinc-600">
                {JSON.stringify(a.payload, null, 2)}
              </pre>
            )}
            <div className="mt-3 flex gap-2">
              <form action={resolveApprovalAction}>
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="decision" value="approved" />
                <button className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
                  Approve
                </button>
              </form>
              <form action={resolveApprovalAction}>
                <input type="hidden" name="approvalId" value={a.id} />
                <input type="hidden" name="decision" value="rejected" />
                <button className="rounded bg-zinc-200 px-3 py-1.5 text-xs font-medium">
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Recently resolved</h2>
        <ul className="space-y-1 text-sm text-zinc-600">
          {resolved.map((a) => (
            <li key={a.id}>
              {a.title} — <span className="font-medium">{a.status}</span>
              {a.resolvedBy ? ` by ${a.resolvedBy}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
