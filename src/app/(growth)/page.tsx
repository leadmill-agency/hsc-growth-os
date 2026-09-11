import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { opportunities, ploybookRuns, approvals, followups, evidence } from "@/lib/db/schema";
import { and, count, desc, eq } from "drizzle-orm";
import type { WeeklyBrief } from "@/lib/ploybooks/pb18-growth-operator/definition";

export const dynamic = "force-dynamic";

// Home = "what should I do right now?" (per Rameel 2026-09-10). Three blocks:
// 1) Do now — the things waiting on a human, 2) Today's brief in plain English,
// 3) shortcuts. Raw activity history lives on /history, not here.

export default async function Home() {
  const db = await getDb();
  const pendingApprovals = await db.query.approvals.findMany({
    where: eq(approvals.status, "pending"),
    orderBy: desc(approvals.requestedAt),
    limit: 5,
  });
  const [pendingCount] = await db
    .select({ n: count() })
    .from(approvals)
    .where(eq(approvals.status, "pending"));
  const [draftedFollowups] = await db
    .select({ n: count() })
    .from(followups)
    .where(eq(followups.status, "drafted"));
  const [decisionsWaiting] = await db
    .select({ n: count() })
    .from(opportunities)
    .where(eq(opportunities.stage, "discovered"));
  const running = await db.query.ploybookRuns.findMany({
    where: eq(ploybookRuns.status, "running"),
    limit: 5,
  });
  const briefRow = await db.query.evidence.findFirst({
    where: and(eq(evidence.entityType, "system"), eq(evidence.fieldName, "weekly_brief")),
    orderBy: desc(evidence.retrievedAt),
  });
  const brief = (briefRow?.value ?? null) as WeeklyBrief | null;

  const todo: { label: string; detail: string; href: string; urgent: boolean }[] = [];
  if (pendingCount.n > 0) {
    todo.push({
      label: `Review ${pendingCount.n} item${pendingCount.n === 1 ? "" : "s"} waiting for your approval`,
      detail: pendingApprovals.map((a) => a.title).slice(0, 3).join(" · "),
      href: "/approvals",
      urgent: true,
    });
  }
  if (draftedFollowups.n > 0) {
    todo.push({
      label: `${draftedFollowups.n} bid follow-up${draftedFollowups.n === 1 ? "" : "s"} drafted and ready to send`,
      detail: "Open each one, add the GC's email, approve to send",
      href: "/approvals",
      urgent: true,
    });
  }
  if (decisionsWaiting.n > 0) {
    todo.push({
      label: `${decisionsWaiting.n} new opportunit${decisionsWaiting.n === 1 ? "y" : "ies"} need a yes/no`,
      detail: "Nothing researches by itself — Pursue the ones worth going deeper on, Dismiss the rest",
      href: "/opportunities",
      urgent: false,
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-xl font-semibold">Today</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Do now</h2>
        {todo.length === 0 ? (
          <p className="rounded-lg border border-fog bg-white p-4 text-sm text-steel">
            Nothing waiting on you. The radar pulls new opportunities every morning — check back
            after ~7:30am, or browse <Link href="/opportunities" className="underline">Opportunities</Link>.
          </p>
        ) : (
          <div className="space-y-2">
            {todo.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`block rounded-lg border p-4 hover:border-signal ${
                  item.urgent ? "border-amber-300 bg-amber-50" : "border-fog bg-white"
                }`}
              >
                <div className="font-semibold">{item.label}</div>
                <div className="mt-0.5 text-sm text-steel">{item.detail}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {brief && (
        <section className="rounded-lg border border-fog bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold">Today's brief</h2>
            <span className="text-xs text-steel">{brief.generatedAt?.slice(0, 10)}</span>
          </div>
          <p className="mt-2 font-medium text-ink">{brief.headline}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-700">
            {brief.what_changed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {brief.recommendations.length > 0 && (
            <ol className="mt-4 space-y-2 text-sm">
              {[...brief.recommendations]
                .sort((a, b) => a.priority - b.priority)
                .slice(0, 4)
                .map((rec, i) => (
                  <li key={rec.action} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-signal px-1.5 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium">{rec.action}</span>
                      <span className="text-steel"> — {rec.reason}</span>
                    </span>
                  </li>
                ))}
            </ol>
          )}
        </section>
      )}

      {running.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-700">Working in the background</h2>
          <ul className="space-y-1 text-sm text-steel">
            {running.map((r) => (
              <li key={r.id}>
                <Link href={`/runs/${r.id}`} className="underline">
                  {r.ploybookKey}
                </Link>{" "}
                — {r.currentStep ?? "starting"} (a few minutes; results land in Approvals or on the cards)
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-steel">
        New to this? Read the <Link href="/guide" className="underline">Guide</Link> (5 minutes).
        Full system log lives in <Link href="/history" className="underline">History</Link>.
      </p>
    </div>
  );
}
