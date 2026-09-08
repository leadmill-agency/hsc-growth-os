import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { createAccountAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const db = await getDb();
  const rows = await db.query.accounts.findMany({ orderBy: desc(accounts.createdAt), limit: 100 });

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Accounts</h1>

      <form action={createAccountAction} className="flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Name
          <input name="name" required className="rounded border border-zinc-300 px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Type
          <select name="accountType" className="rounded border border-zinc-300 px-2 py-1 text-sm">
            {[
              "general_contractor",
              "developer",
              "property_owner",
              "architect",
              "franchise",
              "franchisee",
              "facility_operator",
              "property_manager",
              "customer",
              "prospect",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-600">
          Website
          <input name="website" className="rounded border border-zinc-300 px-2 py-1 text-sm" />
        </label>
        <button className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
          Add account
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs text-zinc-500">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th>Domain</th>
            <th>Fit</th>
            <th>Strategic</th>
            <th>Relationship</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-zinc-100">
              <td className="py-2 font-medium">{a.name}</td>
              <td className="text-zinc-600">{a.accountType}</td>
              <td className="text-zinc-600">{a.domain ?? "—"}</td>
              <td>{a.hscFitScore ?? "—"}</td>
              <td>{a.strategicValueScore ?? "—"}</td>
              <td>{a.relationshipScore ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-sm text-zinc-500">No accounts yet.</p>}
    </div>
  );
}
