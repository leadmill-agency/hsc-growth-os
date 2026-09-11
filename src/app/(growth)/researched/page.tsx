import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  opportunities,
  accounts,
  contacts,
  evidence,
  approvals,
  ploybookRuns,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  writeEmailAction,
  launchAccountPloybookAction,
  resolveApprovalAction,
  setOpportunityStageAction,
} from "@/app/actions";
import { EmailApprovalCard, SwarmApprovalCard } from "./email-card";
import { BidDesk } from "./bid-desk";

export const dynamic = "force-dynamic";

// The Researched hub (per Rameel 2026-09-10): everything that has been (or is
// being) researched, ready to act on. Two tabs: Researched Opportunities —
// briefs + contacts with Write email / Swarm / ABM page — and Bids Interested
// In — the working bid desk. This replaces the Approvals and Accounts tabs.

const EMAIL_TYPES = ["send_outreach", "send_followup"];

export default async function ResearchedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const db = await getDb();

  // Researched (and in-flight) opportunities that aren't inbound bids.
  const rows = await db.query.opportunities.findMany({
    where: and(
      inArray(opportunities.stage, ["researching", "researched", "pursuing"]),
      notInArray(sql`coalesce(${opportunities.opportunityType}, '')`, ["incoming_bid", "bid"])
    ),
    orderBy: [
      desc(sql`coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, -1)`),
      desc(opportunities.updatedAt),
    ],
    limit: 100,
  });

  const accountIds = [...new Set(rows.map((r) => r.accountId).filter((id): id is string => !!id))];
  const accts = accountIds.length
    ? await db.query.accounts.findMany({ where: inArray(accounts.id, accountIds) })
    : [];
  const acctById = new Map(accts.map((a) => [a.id, a]));
  const contactRows = accountIds.length
    ? await db.query.contacts.findMany({ where: inArray(contacts.accountId, accountIds) })
    : [];
  const contactsByAccount = new Map<string, (typeof contactRows)[number][]>();
  for (const c of contactRows) {
    if (!c.accountId) continue;
    const list = contactsByAccount.get(c.accountId) ?? [];
    if (list.length < 3) list.push(c);
    contactsByAccount.set(c.accountId, list);
  }

  const oppIds = rows.map((r) => r.id);
  const whyRows = oppIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "opportunity"),
          eq(evidence.fieldName, "why_this_matters"),
          inArray(evidence.entityId, oppIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const whyByOpp = new Map<string, string>();
  for (const row of whyRows) {
    if (!whyByOpp.has(row.entityId)) whyByOpp.set(row.entityId, String(row.value ?? ""));
  }

  // The narrative research brief per account (rendered in full on the account page).
  const briefRows = accountIds.length
    ? await db.query.evidence.findMany({
        where: and(
          eq(evidence.entityType, "account"),
          eq(evidence.fieldName, "research_brief"),
          inArray(evidence.entityId, accountIds)
        ),
        orderBy: desc(evidence.retrievedAt),
      })
    : [];
  const briefByAccount = new Map<string, { lead?: string; approach?: string }>();
  for (const row of briefRows) {
    if (briefByAccount.has(row.entityId)) continue;
    const v = row.value as Record<string, unknown>;
    briefByAccount.set(row.entityId, {
      lead: (v.bottom_line ?? v.about) as string | undefined,
      approach: (v.how_to_approach ?? v.recommendation) as string | undefined,
    });
  }

  // Pending email drafts, matched to their opportunity when possible.
  const pendingEmails = await db.query.approvals.findMany({
    where: and(eq(approvals.status, "pending"), inArray(approvals.approvalType, EMAIL_TYPES)),
    orderBy: desc(approvals.requestedAt),
  });
  const emailsByOpp = new Map<string, typeof pendingEmails>();
  const unmatchedEmails: typeof pendingEmails = [];
  const oppIdByAccount = new Map<string, string>();
  for (const r of rows) {
    if (r.accountId && !oppIdByAccount.has(r.accountId)) oppIdByAccount.set(r.accountId, r.id);
  }
  for (const a of pendingEmails) {
    const p = (a.payload ?? {}) as { opportunityId?: string; accountId?: string };
    // Match by opportunity, else by account (swarm fan-out cards carry accountId).
    const oppId =
      p.opportunityId && oppIds.includes(p.opportunityId)
        ? p.opportunityId
        : p.accountId
          ? oppIdByAccount.get(p.accountId)
          : undefined;
    if (oppId) {
      const list = emailsByOpp.get(oppId) ?? [];
      list.push(a);
      emailsByOpp.set(oppId, list);
    } else {
      unmatchedEmails.push(a);
    }
  }

  // Swarm sequences get their own readable cards.
  const swarmApprovals = await db.query.approvals.findMany({
    where: and(eq(approvals.status, "pending"), eq(approvals.approvalType, "swarm_outreach")),
    orderBy: desc(approvals.requestedAt),
  });

  // Anything else pending (supplier RFQs, page publishes) stays actionable here.
  const otherApprovals = await db.query.approvals.findMany({
    where: and(
      eq(approvals.status, "pending"),
      notInArray(approvals.approvalType, [...EMAIL_TYPES, "accept_bid", "swarm_outreach"])
    ),
    orderBy: desc(approvals.requestedAt),
  });

  // In-flight research indicator.
  const activeRuns = await db.query.ploybookRuns.findMany({
    where: and(
      eq(ploybookRuns.status, "running"),
      inArray(ploybookRuns.ploybookKey, [
        "pb01_gc_pursuit",
        "pb02_commercial_development",
        "pb03_franchise_expansion",
        "pb04_facility_portfolio",
        "pb09_account_research",
      ])
    ),
    limit: 10,
  });

  const tabs = [
    { key: "accounts", label: "Researched Opportunities", count: rows.length },
    { key: "bids", label: "Bids Interested In", count: null as number | null },
  ];
  const activeTab = tab === "bids" ? "bids" : "accounts";

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Researched</h1>

      <div className="flex gap-1 border-b border-fog">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/researched?tab=${t.key}`}
            className={`-mb-px rounded-t-lg border-x border-t px-4 py-2 text-sm font-medium ${
              activeTab === t.key
                ? "border-fog bg-white text-ink"
                : "border-transparent text-steel hover:text-ink"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  t.count > 0 ? "bg-signal text-white" : "bg-cloud text-steel"
                }`}
              >
                {t.count}
              </span>
            )}
          </a>
        ))}
      </div>

      {activeTab === "bids" ? (
        <BidDesk />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-steel">
            Everything researched (or researching now), best first. Review the brief and
            contacts, then act: <span className="font-medium">Write email</span> finds the
            contact&apos;s address and drafts in your voice — you review, edit, and send.
            Nothing sends without you.
          </p>

          {activeRuns.length > 0 && (
            <p className="rounded-lg border border-fog bg-white px-4 py-2 text-xs text-steel">
              {activeRuns.length} research run{activeRuns.length === 1 ? "" : "s"} working right
              now — cards land here as they finish (refresh to update).
            </p>
          )}

          {rows.length === 0 && (
            <p className="text-sm text-steel">
              Nothing researched yet. Hit Pursue on cards in{" "}
              <Link href="/opportunities" className="underline">Opportunities</Link> — or let the
              morning auto-research fill this in.
            </p>
          )}

          {rows.map((o) => {
            const account = o.accountId ? acctById.get(o.accountId) : null;
            const people = o.accountId ? (contactsByAccount.get(o.accountId) ?? []) : [];
            const why = whyByOpp.get(o.id);
            const drafts = emailsByOpp.get(o.id) ?? [];
            const score = o.overallScore ?? o.fitScore;
            return (
              <div key={o.id} className="space-y-2">
                <div className="rounded-lg border border-fog bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink font-display text-lg font-bold text-white"
                      title="Relevance score"
                    >
                      {score ?? "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug">{o.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-steel">
                        <span className="uppercase tracking-wide">
                          {o.stage === "researching" ? "researching now…" : o.stage}
                        </span>
                        {account && (
                          <Link href={`/accounts/${account.id}`} className="underline hover:text-signal">
                            {account.name} — full profile
                          </Link>
                        )}
                        {account?.website && (
                          <a href={account.website} target="_blank" className="underline hover:text-signal">
                            website
                          </a>
                        )}
                      </div>
                      {o.nextAction && <p className="mt-1 text-xs text-steel">{o.nextAction}</p>}
                      {(() => {
                        const b = o.accountId ? briefByAccount.get(o.accountId) : null;
                        if (b?.lead)
                          return (
                            <p className="mt-2 text-sm leading-relaxed text-ink-700">
                              {b.lead}
                              {b.approach && (
                                <span className="mt-1 block text-xs font-medium text-ink">
                                  How to approach:{" "}
                                  <span className="font-normal text-steel">{b.approach}</span>
                                </span>
                              )}
                            </p>
                          );
                        return why ? <p className="mt-2 text-sm text-ink-700">{why}</p> : null;
                      })()}
                      {people.length > 0 ? (
                        <div className="mt-2 space-y-0.5 text-sm">
                          {people.map((c) => (
                            <div key={c.id}>
                              👤 <span className="font-medium">{[c.firstName, c.lastName].filter(Boolean).join(" ")}</span>
                              {c.title && <span className="text-steel"> — {c.title}</span>}
                              {c.email && <span className="text-xs text-steel"> · {c.email}</span>}
                              {c.linkedinUrl && (
                                <a href={c.linkedinUrl} target="_blank" className="ml-1 text-xs underline hover:text-signal">
                                  LinkedIn
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-steel">
                          No contacts stored yet — the account profile has the research detail.
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {o.stage !== "researching" && account && (
                        <>
                        <form action={writeEmailAction}>
                          <input type="hidden" name="opportunityId" value={o.id} />
                          <button
                            className="rounded bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-600"
                            title="Find the contact's email (Hunter) and draft in your voice — the editable draft appears below this card"
                          >
                            Write email
                          </button>
                        </form>
                        <form action={launchAccountPloybookAction}>
                          <input type="hidden" name="accountName" value={account.name} />
                          <input type="hidden" name="accountId" value={account.id} />
                          <input type="hidden" name="which" value="swarm" />
                          <button className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                            Company swarm
                          </button>
                        </form>
                        <form action={launchAccountPloybookAction}>
                          <input type="hidden" name="accountName" value={account.name} />
                          <input type="hidden" name="accountId" value={account.id} />
                          <input type="hidden" name="which" value="abm_page" />
                          <button className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                            ABM page
                          </button>
                        </form>
                        </>
                      )}
                      {/* Not interested after reading the research? That's a
                          valid outcome — the brief stays on the account. */}
                      <form action={setOpportunityStageAction}>
                        <input type="hidden" name="opportunityId" value={o.id} />
                        <input type="hidden" name="stage" value="dismissed" />
                        <button
                          className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-steel hover:border-signal"
                          title="Not interested — removes the card; the research stays on the account if they ever come back"
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
                {drafts.map((a) => (
                  <EmailApprovalCard key={a.id} approval={a} />
                ))}
              </div>
            );
          })}

          {swarmApprovals.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-700">
                Swarm sequences waiting on you ({swarmApprovals.length})
              </h2>
              {swarmApprovals.map((a) => (
                <SwarmApprovalCard key={a.id} approval={a} />
              ))}
            </section>
          )}

          {unmatchedEmails.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-700">
                Other email drafts waiting ({unmatchedEmails.length})
              </h2>
              {unmatchedEmails.map((a) => (
                <EmailApprovalCard key={a.id} approval={a} />
              ))}
            </section>
          )}

          {otherApprovals.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-ink-700">
                Other approvals ({otherApprovals.length})
              </h2>
              {otherApprovals.map((a) => (
                <div key={a.id} className="rounded-lg border border-amber-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-wide text-steel/70">{a.approvalType}</div>
                  <div className="mt-1 text-sm font-semibold">{a.title}</div>
                  {a.summary && <p className="mt-1 text-sm text-steel">{a.summary}</p>}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-steel/70">Details</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-cloud p-2 text-xs text-steel">
                      {JSON.stringify(a.payload, null, 2)}
                    </pre>
                  </details>
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
                      <button className="rounded bg-fog px-3 py-1.5 text-xs font-medium">Reject</button>
                    </form>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
