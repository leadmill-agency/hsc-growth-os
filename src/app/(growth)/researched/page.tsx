import Link from "next/link";
import { SubmitButton } from "@/app/(growth)/submit-button";
import { getDb } from "@/lib/db/client";
import { DISMISS_REASONS } from "@/lib/dismiss-reasons";
import {
  opportunities,
  accounts,
  contacts,
  evidence,
  approvals,
  ploybookRuns,
} from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, notInArray, sql } from "drizzle-orm";
import {
  writeEmailAction,
  launchAccountPloybookAction,
  resolveApprovalAction,
  setOpportunityStageAction,
  addContactEmailAction,
  cancelQueuedSendAction,
} from "@/app/actions";
import { EmailApprovalCard, SwarmApprovalCard } from "./email-card";
import { BidDesk } from "./bid-desk";

export const dynamic = "force-dynamic";

// The Researched WORKSPACE (Rameel 2026-09-21): three tabs in one view so
// acting on research never means commuting between pages. Companies = the
// research cards, self-contained (lead, human "how to approach", contact
// chips, actions). Outbox = every draft waiting on a human — outreach emails,
// swarm sequences, ABM/publish approvals — plus what recently went out.
// Bids = the bid desk.

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
      inArray(opportunities.stage, ["researching", "researched"]),
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

  // Outbox: everything drafted and waiting, plus what recently went out.
  const pendingEmails = await db.query.approvals.findMany({
    where: and(eq(approvals.status, "pending"), inArray(approvals.approvalType, EMAIL_TYPES)),
    orderBy: desc(approvals.requestedAt),
  });
  const swarmApprovals = await db.query.approvals.findMany({
    where: and(eq(approvals.status, "pending"), eq(approvals.approvalType, "swarm_outreach")),
    orderBy: desc(approvals.requestedAt),
  });
  const otherApprovals = await db.query.approvals.findMany({
    where: and(
      eq(approvals.status, "pending"),
      notInArray(approvals.approvalType, [...EMAIL_TYPES, "accept_bid", "swarm_outreach"])
    ),
    orderBy: desc(approvals.requestedAt),
  });
  // Approved emails waiting in the human-cadence send queue (9am–5:30pm CT,
  // ~5 min apart) — cancellable until the moment they go out.
  const scheduledSends = (
    await db.query.approvals.findMany({
      where: and(
        inArray(approvals.approvalType, EMAIL_TYPES),
        inArray(approvals.status, ["approved", "edited"])
      ),
      orderBy: desc(approvals.resolvedAt),
      limit: 100,
    })
  )
    .filter((a) => {
      const p = a.payload as { queuedSend?: { sendAt: string }; sentAt?: string };
      return p.queuedSend && !p.sentAt;
    })
    .sort((a, b) => {
      const at = (x: typeof a) => new Date((x.payload as { queuedSend: { sendAt: string } }).queuedSend.sendAt).getTime();
      return at(a) - at(b);
    });

  const recentlySent = (
    await db.query.approvals.findMany({
      where: and(
        inArray(approvals.approvalType, EMAIL_TYPES),
        eq(approvals.status, "approved"),
        gte(approvals.resolvedAt, new Date(Date.now() - 7 * 24 * 3600 * 1000))
      ),
      orderBy: desc(approvals.resolvedAt),
      limit: 10,
    })
  ).filter((a) => (a.payload as { sentTo?: string })?.sentTo);
  const outboxCount = pendingEmails.length + swarmApprovals.length + otherApprovals.length;

  // Which companies already have a draft waiting (link the card to the Outbox).
  const draftsByAccount = new Map<string, number>();
  for (const a of [...pendingEmails, ...swarmApprovals]) {
    const p = (a.payload ?? {}) as { accountId?: string };
    if (p.accountId) draftsByAccount.set(p.accountId, (draftsByAccount.get(p.accountId) ?? 0) + 1);
  }

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
    { key: "companies", label: "Companies", count: rows.length },
    { key: "outbox", label: "Outbox", count: outboxCount },
    { key: "bids", label: "Bids", count: null as number | null },
  ];
  const activeTab = tab === "bids" ? "bids" : tab === "outbox" ? "outbox" : "companies";

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
      ) : activeTab === "outbox" ? (
        <div className="space-y-4">
          <p className="text-xs text-steel">
            Everything drafted and waiting on you. Review, edit, and approve — nothing sends
            without you. Sent emails BCC to ray@ and live in{" "}
            <Link href="/history" className="underline">History</Link>.
          </p>

          {outboxCount === 0 && scheduledSends.length === 0 && recentlySent.length === 0 && (
            <p className="text-sm text-steel">
              Outbox is empty. Hit <span className="font-medium">Write email</span> or{" "}
              <span className="font-medium">Company swarm</span> on a company card and the
              draft lands here.
            </p>
          )}

          {pendingEmails.map((a) => (
            <EmailApprovalCard key={a.id} approval={a} />
          ))}
          {swarmApprovals.map((a) => (
            <SwarmApprovalCard key={a.id} approval={a} />
          ))}

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
                      <SubmitButton className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
                        Approve
                      </SubmitButton>
                    </form>
                    <form action={resolveApprovalAction}>
                      <input type="hidden" name="approvalId" value={a.id} />
                      <input type="hidden" name="decision" value="rejected" />
                      <SubmitButton className="rounded bg-fog px-3 py-1.5 text-xs font-medium">Reject</SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </section>
          )}

          {scheduledSends.length > 0 && (
            <section className="space-y-1">
              <h2 className="text-sm font-semibold text-ink-700">
                Scheduled ({scheduledSends.length}) — sends 9am–5:30pm, ~5 min apart
              </h2>
              {scheduledSends.map((a) => {
                const q = (a.payload as { queuedSend: { to: string; subject: string; sendAt: string } }).queuedSend;
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded border border-cloud bg-white px-3 py-1.5 text-xs">
                    <span className="text-signal">→</span>
                    <span className="min-w-0 flex-1 truncate text-ink-700">
                      {q.to} — {q.subject}
                    </span>
                    <span className="text-steel">
                      sends{" "}
                      {new Date(q.sendAt).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    <form action={cancelQueuedSendAction}>
                      <input type="hidden" name="approvalId" value={a.id} />
                      <SubmitButton className="rounded border border-fog bg-white px-2 py-0.5 text-[11px] font-medium text-steel hover:border-signal">
                        Cancel
                      </SubmitButton>
                    </form>
                  </div>
                );
              })}
            </section>
          )}

          {recentlySent.length > 0 && (
            <section className="space-y-1">
              <h2 className="text-sm font-semibold text-ink-700">Sent this week</h2>
              {recentlySent.map((a) => {
                const p = a.payload as { sentTo?: string; sentSubject?: string };
                return (
                  <div key={a.id} className="flex items-center gap-2 rounded border border-cloud bg-white px-3 py-1.5 text-xs text-steel">
                    <span className="text-emerald-700">✓</span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.sentTo} — {p.sentSubject ?? a.title}
                    </span>
                    <span>{a.resolvedAt?.toLocaleDateString()}</span>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-steel">
            Everything researched, best first: what the company is, who to email, and the
            buttons to do it. Drafts land in the{" "}
            <Link href="/researched?tab=outbox" className="underline">Outbox tab</Link> for
            review — nothing sends without you.
          </p>

          {activeRuns.length > 0 && (
            <p className="rounded-lg border border-fog bg-white px-4 py-2 text-xs text-steel">
              {activeRuns.length} research run{activeRuns.length === 1 ? "" : "s"} working right
              now — cards land here as they finish (refresh to update).
            </p>
          )}

          {rows.length === 0 && (
            <p className="text-sm text-steel">
              Nothing researched yet. Hit Pursue on rows in{" "}
              <Link href="/opportunities" className="underline">Opportunities</Link>.
            </p>
          )}

          {rows.map((o) => {
            const account = o.accountId ? acctById.get(o.accountId) : null;
            const people = o.accountId ? (contactsByAccount.get(o.accountId) ?? []) : [];
            const why = whyByOpp.get(o.id);
            const brief = o.accountId ? briefByAccount.get(o.accountId) : null;
            const draftCount = o.accountId ? (draftsByAccount.get(o.accountId) ?? 0) : 0;
            const score = o.overallScore ?? o.fitScore;
            return (
              <div key={o.id} className="rounded-lg border border-fog bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold leading-snug">{account?.name ?? o.name}</span>
                      {o.scale === "rollout" && (
                        <span className="rounded-full bg-signal/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-signal">
                          rollout
                        </span>
                      )}
                      <span className="text-xs font-semibold text-signal" title="Relevance score">
                        {score ?? ""}
                      </span>
                      {o.stage === "researching" && (
                        <span className="text-xs uppercase tracking-wide text-amber-700">researching now…</span>
                      )}
                      {account?.website && (
                        <a href={account.website} target="_blank" className="text-xs text-steel underline hover:text-signal">
                          website
                        </a>
                      )}
                      {account && (
                        <Link href={`/accounts/${account.id}`} className="text-xs text-steel underline hover:text-signal">
                          full brief
                        </Link>
                      )}
                      {draftCount > 0 && (
                        <Link href="/researched?tab=outbox" className="text-xs font-medium text-signal underline">
                          {draftCount} draft{draftCount === 1 ? "" : "s"} in Outbox
                        </Link>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-700">
                      {brief?.lead ?? why ?? "Research in progress."}
                    </p>
                    {brief?.approach && (
                      <div className="mt-2 rounded-md bg-cloud/70 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-steel">
                          How to approach
                        </div>
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{brief.approach}</p>
                      </div>
                    )}
                    {people.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {people.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-2 rounded-md border border-fog px-2.5 py-1.5 text-xs"
                          >
                            <div>
                              <div className="font-medium">
                                {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                              </div>
                              <div className="text-steel">
                                {c.title}
                                {c.email ? (
                                  <span className="text-emerald-700"> · email found</span>
                                ) : c.emailLookupAt ? (
                                  <span className="text-amber-700"> · Apollo + Hunter came up empty</span>
                                ) : (
                                  <span className="text-steel"> · lookup pending</span>
                                )}
                                {c.linkedinUrl && (
                                  <a href={c.linkedinUrl} target="_blank" className="ml-1 underline hover:text-signal">
                                    LinkedIn
                                  </a>
                                )}
                              </div>
                              {!c.email && (
                                <form action={addContactEmailAction} className="mt-1 flex items-center gap-1">
                                  <input type="hidden" name="contactId" value={c.id} />
                                  <input type="hidden" name="opportunityId" value={o.id} />
                                  <input
                                    name="email"
                                    type="email"
                                    placeholder="paste email"
                                    className="w-32 rounded border border-fog px-1.5 py-0.5 text-[11px]"
                                  />
                                  <SubmitButton
                                    className="rounded border border-fog bg-white px-1.5 py-0.5 text-[11px] font-medium text-ink-700 hover:border-signal"
                                    title="Save the address and draft the email"
                                  >
                                    Draft
                                  </SubmitButton>
                                </form>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      o.stage !== "researching" && (
                        <p className="mt-2 text-xs text-steel">
                          No contacts stored yet — Write email will hunt an address; the full
                          brief has the research detail.
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {o.stage !== "researching" && account && (
                      <>
                        <form action={writeEmailAction}>
                          <input type="hidden" name="opportunityId" value={o.id} />
                          <SubmitButton
                            className="rounded bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-600"
                            title="Find the contact's email and draft in your voice — the editable draft lands in the Outbox tab"
                          >
                            Write email
                          </SubmitButton>
                        </form>
                        <form action={launchAccountPloybookAction}>
                          <input type="hidden" name="accountName" value={account.name} />
                          <input type="hidden" name="accountId" value={account.id} />
                          <input type="hidden" name="which" value="swarm" />
                          <SubmitButton className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                            Company swarm
                          </SubmitButton>
                        </form>
                        <form action={launchAccountPloybookAction}>
                          <input type="hidden" name="accountName" value={account.name} />
                          <input type="hidden" name="accountId" value={account.id} />
                          <input type="hidden" name="which" value="abm_page" />
                          <SubmitButton className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-ink-700 hover:border-signal">
                            ABM page
                          </SubmitButton>
                        </form>
                      </>
                    )}
                    <form action={setOpportunityStageAction} className="flex flex-col items-end gap-1">
                      <input type="hidden" name="opportunityId" value={o.id} />
                      <input type="hidden" name="stage" value="dismissed" />
                      <select
                        name="dismissReason"
                        defaultValue=""
                        className="w-32 rounded border border-fog bg-white px-1 py-0.5 text-[11px] text-steel"
                        title="Optional — a reason teaches the radar what to score lower"
                      >
                        <option value="">
                          Why? (optional)
                        </option>
                        {DISMISS_REASONS.map(([code, label]) => (
                          <option key={code} value={code}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        name="dismissNote"
                        placeholder="Note (if Other)"
                        className="w-32 rounded border border-fog px-1.5 py-0.5 text-[11px]"
                      />
                      <SubmitButton
                        className="rounded border border-fog bg-white px-2.5 py-1 text-xs font-medium text-steel hover:border-signal"
                        title="Not interested — removes the card (reason optional)"
                      >
                        Dismiss
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
