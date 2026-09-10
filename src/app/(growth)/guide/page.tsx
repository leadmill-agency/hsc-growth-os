import { GENERAL_GUIDE, PLOYBOOK_GUIDES } from "@/lib/guide";

// Team guide — how to actually use the system. Same content powers the
// "How to use this" expanders on the Ploybooks page.

export const dynamic = "force-static";

const ORDER = [
  "pb05_opportunity_radar",
  "pb01_gc_pursuit",
  "pb09_account_research",
  "pb02_commercial_development",
  "pb03_franchise_expansion",
  "pb04_facility_portfolio",
  "pb06_company_swarm",
  "pb07_abm_page",
  "pb08_high_intent_visitor",
  "pb10_incoming_bid",
  "pb11_bid_analyzer",
  "pb12_bid_qa",
  "pb13_bid_followup",
  "pb14_deal_room",
  "pb15_business_case",
  "pb16_local_seo",
  "pb17_content_builder",
  "pb18_growth_operator",
  "pb00_dummy",
];

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">How to use Growth OS</h1>
        <p className="mt-3 text-ink-700">{GENERAL_GUIDE.intro}</p>
      </div>

      <section className="rounded-lg border border-fog bg-white p-5">
        <h2 className="text-sm font-semibold">What happens by itself</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-700">
          {GENERAL_GUIDE.rhythm.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-fog bg-white p-5">
          <h2 className="text-sm font-semibold">Scores</h2>
          <p className="mt-2 text-sm text-ink-700">{GENERAL_GUIDE.scores}</p>
        </div>
        <div className="rounded-lg border border-fog bg-white p-5">
          <h2 className="text-sm font-semibold">Approvals</h2>
          <p className="mt-2 text-sm text-ink-700">{GENERAL_GUIDE.approvals}</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">The playbooks</h2>
        {ORDER.map((key) => {
          const g = PLOYBOOK_GUIDES[key];
          if (!g) return null;
          return (
            <div key={key} className="rounded-lg border border-fog bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{g.title}</h3>
                <span className="text-xs text-steel">
                  {key.split("_")[0].toUpperCase()} · for {g.audience}
                </span>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-ink-700">When to use it</dt>
                  <dd className="text-steel">{g.whenToUse}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-700">What to enter</dt>
                  <dd className="text-steel">{g.whatToEnter}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-700">What happens</dt>
                  <dd className="text-steel">{g.whatHappens}</dd>
                </div>
                <div>
                  <dt className="font-medium text-ink-700">What you get</dt>
                  <dd className="text-steel">{g.whatYouGet}</dd>
                </div>
                {g.goodExample && (
                  <div>
                    <dt className="font-medium text-ink-700">Example</dt>
                    <dd className="text-steel">{g.goodExample}</dd>
                  </div>
                )}
                {g.caveat && (
                  <div className="rounded bg-amber-50 px-3 py-2 text-amber-900">{g.caveat}</div>
                )}
              </dl>
            </div>
          );
        })}
      </section>
    </div>
  );
}
