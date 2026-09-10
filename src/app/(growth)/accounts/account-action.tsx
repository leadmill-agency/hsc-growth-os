import { launchAccountPloybookAction } from "@/app/actions";

export const typeLabels: Record<string, string> = {
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

// One button = one account ploybook launch (PB09 research / PB06 swarm / PB07 page).
// Shared by the accounts table and the account detail page.

export function AccountAction({
  accountName,
  accountId,
  which,
  label,
  title,
}: {
  accountName: string;
  accountId: string;
  which: string;
  label: string;
  title: string;
}) {
  return (
    <form action={launchAccountPloybookAction} className="inline">
      <input type="hidden" name="accountName" value={accountName} />
      <input type="hidden" name="accountId" value={accountId} />
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

export const ACCOUNT_ACTION_PROPS = {
  research: {
    which: "research",
    label: "Research",
    title: "Build a full profile: leadership, locations, recent projects (~5 min)",
  },
  swarm: {
    which: "swarm",
    label: "Swarm",
    title: "Draft outreach to multiple contacts at this company — drafts land in Approvals",
  },
  abm_page: {
    which: "abm_page",
    label: "Sales page",
    title: "Build a personalized proposal page for this company to send them",
  },
} as const;
