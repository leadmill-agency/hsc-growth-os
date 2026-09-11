import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import {
  accounts,
  contacts,
  opportunities,
  evidence,
  activities,
  ploybookRuns,
} from "@/lib/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { PLOYBOOK_GUIDES } from "@/lib/guide";
import { AccountAction, ACCOUNT_ACTION_PROPS, typeLabels } from "../account-action";

export const dynamic = "force-dynamic";

// Answers "why is this account here?" (per Rameel): what brought it in, the
// projects attached to it, every researched fact with its verification status,
// and the known people — then the same act buttons as the table.

const fieldLabels: Record<string, string> = {
  why_this_matters: "Why this matters",
  leadership: "Leadership",
  locations: "Locations",
  recent_projects: "Recent projects",
  account_profile: "Account profile",
  research_summary: "Research summary",
  invitation: "Original invitation",
};

const verificationStyle: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  inferred: "bg-amber-100 text-amber-900",
  assumed: "bg-cloud text-steel",
  unknown: "bg-cloud text-steel",
};

function prettyField(name: string): string {
  return fieldLabels[name] ?? name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

const launchedBanners: Record<string, string> = {
  research:
    "Research started — it runs for ~5 minutes in the background. Findings appear on this page; refresh to check in.",
  swarm:
    "Swarm started — it finds the decision-makers and drafts outreach to each. The drafts land in Approvals in ~5 minutes; nothing sends without you.",
  abm_page:
    "Sales page build started — the draft page lands in Approvals in ~5 minutes for your review before it gets a shareable link.",
};

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ launched?: string }>;
}) {
  const { id } = await params;
  const { launched } = await searchParams;
  const db = await getDb();
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (!account) notFound();

  const [contactRows, oppRows, evidenceRows, activityRows] = await Promise.all([
    db.query.contacts.findMany({ where: eq(contacts.accountId, id), limit: 50 }),
    db.query.opportunities.findMany({
      where: eq(opportunities.accountId, id),
      orderBy: desc(opportunities.createdAt),
      limit: 50,
    }),
    db.query.evidence.findMany({
      where: and(eq(evidence.entityType, "account"), eq(evidence.entityId, id)),
      orderBy: desc(evidence.retrievedAt),
      limit: 100,
    }),
    db.query.activities.findMany({
      where: and(eq(activities.entityType, "account"), eq(activities.entityId, id)),
      orderBy: desc(activities.occurredAt),
      limit: 50,
    }),
  ]);

  // Anything currently working on this account — the launch buttons run in the
  // background, so without this the click looks like it did nothing.
  const activeRuns = await db.query.ploybookRuns.findMany({
    where: sql`${ploybookRuns.status} in ('running', 'queued', 'waiting_for_approval')
      and ${ploybookRuns.triggerPayload}->>'accountName' = ${account.name}`,
    orderBy: desc(ploybookRuns.createdAt),
    limit: 5,
  });

  // Where did this account come from? The creation activity names the run, the
  // run names the ploybook, and the guide gives it a human name.
  const created = activityRows.find((a) => a.action === "account.created");
  const runIds = activityRows.map((a) => a.ploybookRunId).filter((r): r is string => !!r);
  const runs = runIds.length
    ? await db.query.ploybookRuns.findMany({ where: inArray(ploybookRuns.id, runIds) })
    : [];
  const runById = new Map(runs.map((r) => [r.id, r]));
  const createdByRun = created?.ploybookRunId ? runById.get(created.ploybookRunId) : null;
  const createdByLabel = createdByRun
    ? (PLOYBOOK_GUIDES[createdByRun.ploybookKey]?.title ?? createdByRun.ploybookKey)
    : created?.actor === "user"
      ? "added by the team"
      : null;

  // The narrative research brief renders as its own section, not a raw fact.
  // Two shapes exist: the readable (presidential-style) brief, and the legacy
  // raw-mapped one (also the test/fallback path) — normalize to readable-ish.
  const briefRow = evidenceRows.find((e) => e.fieldName === "research_brief");
  const rawBrief = (briefRow?.value ?? null) as Record<string, unknown> | null;
  const researchBrief = rawBrief
    ? {
        bottom_line: (rawBrief.bottom_line ?? rawBrief.headline ?? "") as string,
        who_they_are: (rawBrief.who_they_are ?? rawBrief.about ?? "") as string,
        whats_happening: (rawBrief.whats_happening ?? rawBrief.signals ?? []) as string[],
        footprint: (rawBrief.footprint ?? []) as string[],
        opportunity: (rawBrief.opportunity ?? "") as string,
        how_to_approach: (rawBrief.how_to_approach ?? rawBrief.recommendation ?? "") as string,
        projects: (rawBrief.projects ?? []) as { name: string; detail: string }[],
        unknowns: (rawBrief.unknowns ?? []) as string[],
        sources: (rawBrief.sources ?? []) as string[],
      }
    : null;
  const scoredEvidence = evidenceRows.filter(
    (e) => e.fieldName !== "invitation" && e.fieldName !== "research_brief"
  );

  return (
    <div className="max-w-3xl space-y-6">
      {launched && launchedBanners[launched] && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          ✓ {launchedBanners[launched]}
        </div>
      )}
      <div>
        <Link href="/accounts" className="text-xs text-steel hover:text-signal">
          ← All accounts
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{account.name}</h1>
          <div className="flex gap-1.5">
            <AccountAction accountName={account.name} accountId={account.id} {...ACCOUNT_ACTION_PROPS.research} />
            <AccountAction accountName={account.name} accountId={account.id} {...ACCOUNT_ACTION_PROPS.swarm} />
            <AccountAction accountName={account.name} accountId={account.id} {...ACCOUNT_ACTION_PROPS.abm_page} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-steel">
          <span>{typeLabels[account.accountType] ?? account.accountType}</span>
          {account.website && (
            <a href={account.website} target="_blank" className="underline hover:text-signal">
              {account.domain ?? account.website}
            </a>
          )}
          {account.headquarters && <span>{account.headquarters}</span>}
          {account.industry && <span>{account.industry}</span>}
        </div>
      </div>

      {activeRuns.length > 0 && (
        <div className="rounded-lg border border-fog bg-white px-4 py-3">
          <div className="text-sm font-semibold text-ink-700">Working on this account right now</div>
          <ul className="mt-1 space-y-1 text-sm text-steel">
            {activeRuns.map((r) => (
              <li key={r.id}>
                <Link href={`/runs/${r.id}`} className="underline hover:text-signal">
                  {PLOYBOOK_GUIDES[r.ploybookKey]?.title ?? r.ploybookKey}
                </Link>{" "}
                — {r.status === "waiting_for_approval"
                  ? "done, waiting on you in Approvals"
                  : `${r.currentStep ?? "starting"} (refresh to update)`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-fog bg-cloud px-4 py-3 text-sm text-ink-700">
        <span className="font-semibold">Why this account is here:</span>{" "}
        {createdByLabel
          ? `created by "${createdByLabel}"`
          : "created automatically during research"}
        {created && ` on ${created.occurredAt.toISOString().slice(0, 10)}`}
        {oppRows.length > 0
          ? `, tied to ${oppRows.length} opportunit${oppRows.length === 1 ? "y" : "ies"} below.`
          : ". No opportunities are attached yet — run Research to build the profile, or it will link up when a project involving them is found."}
      </div>

      <section className="grid grid-cols-3 gap-3">
        {(
          [
            ["Fit", account.hscFitScore, "How well their work matches what HSC sells"],
            ["Value", account.strategicValueScore, "How much repeat business a relationship could bring"],
            ["Relationship", account.relationshipScore, "How warm the relationship is today"],
          ] as const
        ).map(([label, score, help]) => (
          <div key={label} className="rounded-lg border border-fog bg-white p-3" title={help}>
            <div className="text-xs text-steel">{label}</div>
            <div className="font-display text-2xl font-bold text-ink">{score ?? "—"}</div>
            <div className="mt-0.5 text-[11px] leading-tight text-steel">{help}</div>
          </div>
        ))}
      </section>

      {researchBrief && (
        <section className="rounded-lg border border-signal/30 bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide">
              Research brief
            </h2>
            {briefRow && (
              <span className="text-xs text-steel">{briefRow.retrievedAt.toISOString().slice(0, 10)}</span>
            )}
          </div>
          {researchBrief.bottom_line && (
            <p className="mt-3 border-l-4 border-signal pl-3 text-[15px] font-semibold leading-relaxed text-ink">
              {researchBrief.bottom_line}
            </p>
          )}
          {researchBrief.who_they_are && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">
                Who they are
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{researchBrief.who_they_are}</p>
            </div>
          )}
          {researchBrief.whats_happening.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">
                What&apos;s happening
              </div>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-relaxed text-ink-700">
                {researchBrief.whats_happening.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {researchBrief.footprint.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">
                Where they are
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-700">
                {researchBrief.footprint.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          {researchBrief.opportunity && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">
                The opportunity for HSC
              </div>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{researchBrief.opportunity}</p>
            </div>
          )}
          {researchBrief.projects.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-steel">
                Projects spotted
              </div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-700">
                {researchBrief.projects.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.name}</span>
                    {p.detail && <span className="text-steel"> — {p.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {researchBrief.how_to_approach && (
            <p className="mt-4 rounded bg-cloud px-3 py-2 text-sm font-medium text-ink">
              How to approach:{" "}
              <span className="font-normal">{researchBrief.how_to_approach}</span>
            </p>
          )}
          {researchBrief.unknowns.length > 0 && (
            <p className="mt-3 text-xs text-steel">
              What we don&apos;t know: {researchBrief.unknowns.join(" · ")}
            </p>
          )}
          {researchBrief.sources.length > 0 && (
            <p className="mt-2 text-xs text-steel">
              Sources:{" "}
              {researchBrief.sources.slice(0, 5).map((s, i) => (
                <a key={i} href={s} target="_blank" className="mr-2 underline hover:text-signal">
                  [{i + 1}]
                </a>
              ))}
            </p>
          )}
        </section>
      )}

      {account.notes && (
        <section className="rounded-lg border border-fog bg-white p-4">
          <h2 className="mb-1 text-sm font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-700">{account.notes}</p>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">
          Opportunities with this company ({oppRows.length})
        </h2>
        {oppRows.length === 0 ? (
          <p className="text-sm text-steel">None yet.</p>
        ) : (
          <div className="space-y-2">
            {oppRows.map((o) => (
              <div key={o.id} className="rounded-lg border border-fog bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{o.name}</div>
                    <div className="text-xs uppercase tracking-wide text-steel">{o.stage}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold">
                    {o.overallScore ?? o.fitScore ?? "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">People ({contactRows.length})</h2>
        {contactRows.length === 0 ? (
          <p className="text-sm text-steel">
            No contacts yet — Research and Swarm identify decision-makers and store them here.
          </p>
        ) : (
          <div className="space-y-1.5">
            {contactRows.map((c) => (
              <div key={c.id} className="rounded-lg border border-fog bg-white px-4 py-2 text-sm">
                <span className="font-medium">
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown"}
                </span>
                {c.title && <span className="text-steel"> — {c.title}</span>}
                <span className="ml-2 text-xs text-steel">
                  {[c.email, c.phone].filter(Boolean).join(" · ")}
                </span>
                {c.linkedinUrl && (
                  <a href={c.linkedinUrl} target="_blank" className="ml-2 text-xs underline hover:text-signal">
                    LinkedIn
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">
          What we know ({scoredEvidence.length} researched facts)
        </h2>
        {scoredEvidence.length === 0 ? (
          <p className="text-sm text-steel">
            Nothing researched yet — hit Research above to build the profile.
          </p>
        ) : (
          <div className="space-y-2">
            {scoredEvidence.map((e) => (
              <div key={e.id} className="rounded-lg border border-fog bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-ink-700">{prettyField(e.fieldName)}</div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`rounded px-1.5 py-0.5 font-medium ${verificationStyle[e.verificationStatus] ?? "bg-cloud text-steel"}`}
                      title="verified = confirmed from a real source · inferred = strong signal, not confirmed"
                    >
                      {e.verificationStatus}
                    </span>
                    <span className="text-steel">{e.retrievedAt.toISOString().slice(0, 10)}</span>
                  </div>
                </div>
                <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-ink-700">
                  {renderValue(e.value)}
                </pre>
                {e.sourceUrl && (
                  <a href={e.sourceUrl} target="_blank" className="text-xs text-steel underline hover:text-signal">
                    source
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Account history</h2>
        <ul className="space-y-1 text-xs text-steel">
          {activityRows.map((a) => (
            <li key={a.id}>
              <span className="font-mono text-steel/70">{a.occurredAt.toISOString().slice(0, 10)}</span>{" "}
              <span className="font-medium text-ink-700">{a.action}</span>
              {a.detail ? ` — ${a.detail}` : ""} <span className="text-steel/60">({a.actor})</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
