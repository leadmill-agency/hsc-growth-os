import { getDb } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { createAccountAction, launchAccountPloybookAction } from "@/app/actions";

export const dynamic = "force-dynamic";

// Accounts = the companies worth a relationship (GCs, franchises, developers),
// as opposed to Opportunities = individual projects. Per Rameel: the tab needs
// to say what it's FOR and let you act on an account (swarm, ABM page, research).

const typeLabels: Record<string, string> = {
  general_contractor: "General contractor",
  developer: "Developer",
  property_owner: "Property owner",
  architect: "Architect",
  franchise: "Franchise brand",
  franchisee: "Franchisee",
  facility_operator: "Facility operator",
  property_manager: "Property manager",
  customer: "Customer",
  prospect: "Prospect",
};

function AccountAction({
  accountName,
  which,
  label,
  title,
}: {
  accountName: string;
  which: string;
  label: string;
  title: string;
}) {
  return (
    <form action={launchAccountPloybookAction} className="inline">
      <input type="hidden" name="accountName" value={accountName} />
      <input type="hidden" name="which" value={which} />
      <button
        title={title}
        className="rounded border border-fog bg-white px-2 py-1 text-xs font-medium text-ink-700 hover:border-signal hover:text-signal"
      >
        {label}
      </button>
    </form>
  );
}

export default async function AccountsPage() {
  const db = await getDb();
  // Most valuable relationships first: strategic value, then fit, newest last.
  const rows = await db.query.accounts.findMany({
    orderBy: [
      desc(sql`coalesce(${accounts.strategicValueScore}, ${accounts.hscFitScore}, -1)`),
      desc(accounts.createdAt),
    ],
    limit: 100,
  });

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-semibold">Accounts</h1>

      <div className="rounded-lg border border-fog bg-cloud px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold">What this tab is for:</span> Opportunities are
        individual projects; accounts are the companies behind them — the GCs, franchises, and
        developers worth a long-term relationship because they buy signs again and again. The
        system creates one automatically whenever research identifies a company. When an
        account looks worth going deeper on, use the buttons on its row:{" "}
        <span className="font-semibold">Swarm</span> drafts a multi-contact outreach sequence
        into Approvals, <span className="font-semibold">Sales page</span> builds a
        personalized proposal page you can send them, and{" "}
        <span className="font-semibold">Research</span> builds a full profile (leadership,
        locations, recent projects). Nothing sends without your approval.
      </div>

      <form action={createAccountAction} className="flex items-end gap-3 rounded-lg border border-fog bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-steel">
          Name
          <input name="name" required className="rounded border border-fog px-2 py-1 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-steel">
          Type
          <select name="accountType" className="rounded border border-fog px-2 py-1 text-sm">
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-steel">
          Website
          <input name="website" className="rounded border border-fog px-2 py-1 text-sm" />
        </label>
        <button className="rounded bg-signal hover:bg-signal-600 px-3 py-1.5 text-sm font-medium text-white">
          Add account
        </button>
      </form>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-fog text-xs text-steel">
            <th className="py-2">Name</th>
            <th>Type</th>
            <th title="How well their work matches what HSC sells (0–100)">Fit</th>
            <th title="How much repeat business a relationship could bring (0–100)">Value</th>
            <th className="text-right">Act</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-cloud">
              <td className="py-2 pr-3">
                <div className="font-medium">{a.name}</div>
                {a.domain && <div className="text-xs text-steel">{a.domain}</div>}
              </td>
              <td className="pr-3 text-steel">{typeLabels[a.accountType ?? ""] ?? a.accountType}</td>
              <td className="pr-3">{a.hscFitScore ?? "—"}</td>
              <td className="pr-3">{a.strategicValueScore ?? "—"}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <AccountAction
                    accountName={a.name}
                    which="research"
                    label="Research"
                    title="Build a full profile: leadership, locations, recent projects (~5 min)"
                  />
                  <AccountAction
                    accountName={a.name}
                    which="swarm"
                    label="Swarm"
                    title="Draft outreach to multiple contacts at this company — drafts land in Approvals"
                  />
                  <AccountAction
                    accountName={a.name}
                    which="abm_page"
                    label="Sales page"
                    title="Build a personalized proposal page for this company to send them"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-sm text-steel">
          No accounts yet. They appear automatically as opportunities get researched, or add one
          above.
        </p>
      )}
    </div>
  );
}
