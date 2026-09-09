import { getDb } from "@/lib/db/client";
import { recordProposalView, type DealRoomContent } from "@/lib/actions/proposals";
import { evidence } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// PB14 — public render of a private deal-room proposal. Unguessable token, noindex,
// every view tracked (interaction + event + high-engagement trigger).

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DealRoomPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const proposal = await recordProposalView(db, token);
  if (!proposal) notFound();

  const contentRow = await db.query.evidence.findMany({
    where: and(eq(evidence.entityType, "proposal"), eq(evidence.fieldName, "deal_room_content")),
    orderBy: desc(evidence.retrievedAt),
    limit: 10,
  });
  const match = contentRow.find((r) => r.entityId === proposal.id);
  if (!match) notFound();
  const content = match.value as DealRoomContent;
  const hasPricing = proposal.total != null;

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wide text-steel">
          Houston Sign Crafters — proposal
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{content.headline}</h1>
        <p className="mt-4 text-ink-700">{content.project_summary}</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">Scope of work</h2>
        <ul className="mt-3 space-y-2">
          {content.scope_items.map((s) => (
            <li key={s.item} className="rounded-lg border border-fog bg-white p-3">
              <span className="font-medium">{s.item}</span>
              <span className="text-steel"> — {s.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-fog bg-white p-4">
        <h2 className="text-lg font-semibold">Investment</h2>
        {hasPricing ? (
          <div className="mt-2 text-2xl font-bold">
            ${Number(proposal.total).toLocaleString()}
            {proposal.subtotal && (
              <span className="ml-2 text-sm font-normal text-steel">
                (subtotal ${Number(proposal.subtotal).toLocaleString()}
                {proposal.tax ? ` + tax $${Number(proposal.tax).toLocaleString()}` : ""})
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-steel">
            Itemized pricing is being finalized from your site survey and will appear here.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Timeline</h2>
        <p className="mt-2 text-ink-700">{content.timeline_note}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Warranty</h2>
        <p className="mt-2 text-ink-700">{content.warranty_note}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Not included</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-ink-700">
          {content.exclusions.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Common questions</h2>
        <div className="mt-3 space-y-3">
          {content.faqs.map((f) => (
            <div key={f.q}>
              <div className="text-sm font-semibold">{f.q}</div>
              <div className="text-sm text-steel">{f.a}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-signal p-6 text-white">
        <div className="text-lg font-semibold">Ready to move forward?</div>
        <p className="mt-1 text-sm text-white/80">{content.next_step}</p>
        <p className="mt-4 text-sm">(832) 974-2546 · sales@houstonsigncrafters.com</p>
      </section>

      <footer className="text-xs text-steel/70">
        UL-certified · Built in Houston · 5-year warranty · 4.8★ from 428+ Google reviews
      </footer>
    </div>
  );
}
