import { getDb } from "@/lib/db/client";
import { recordPageView, type AbmPageContent } from "@/lib/actions/abm-pages";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// PB07 — public render of a private ABM page. Unguessable token, noindex, view-tracked.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AbmPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const page = await recordPageView(db, token);
  if (!page) notFound();
  const content = page.content as AbmPageContent;

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-6 py-12">
      <header>
        <div className="text-xs font-semibold uppercase tracking-wide text-steel">
          Houston Sign Crafters — prepared for you
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{content.headline}</h1>
        <p className="mt-4 text-ink-700">{content.intro}</p>
      </header>

      <section>
        <h2 className="text-lg font-semibold">What we'd bring to this</h2>
        <ul className="mt-3 space-y-2">
          {content.relevant_capabilities.map((c) => (
            <li key={c.capability} className="rounded-lg border border-fog bg-white p-3">
              <span className="font-medium capitalize">{c.capability}</span>
              <span className="text-steel"> — {c.why_relevant}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Why this fits your situation</h2>
        <p className="mt-2 text-ink-700">{content.account_context}</p>
        {content.local_facts.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-steel">
            {content.local_facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Relevant work</h2>
        <div className="mt-3 grid gap-3">
          {content.proof_points.map((proof) => (
            <div key={proof.title} className="rounded-lg border border-fog bg-cloud p-3">
              <div className="text-sm font-medium">{proof.title}</div>
              <div className="text-sm text-steel">{proof.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl bg-signal hover:bg-signal-600 p-6 text-white">
        <div className="text-lg font-semibold">{content.cta_label}</div>
        <p className="mt-1 text-sm text-white/60">{content.cta_detail}</p>
        <p className="mt-4 text-sm">
          (832) 974-2546 · sales@houstonsigncrafters.com
        </p>
      </section>

      <footer className="text-xs text-steel/70">
        UL-certified · Built in Houston · 5-year warranty · 4.8★ from 428+ Google reviews
      </footer>
    </div>
  );
}
