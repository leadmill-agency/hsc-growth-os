import { describe, expect, it } from "vitest";
import {
  comboDemand,
  orderCombosByDemand,
  pickImprovementTarget,
  rankOpportunities,
} from "./opportunities";
import { extractPageText } from "@/lib/ploybooks/pb17-content-builder/improve";
import type { QueryPageRow } from "@/lib/integrations/gsc/client";

const SITE = [
  "https://houstonsigncrafters.com/",
  "https://houstonsigncrafters.com/services/channel-letters",
  "https://houstonsigncrafters.com/services/monument-signs",
  "https://houstonsigncrafters.com/sign-permits",
];

const row = (query: string, page: string, impressions: number, position: number): QueryPageRow => ({
  query,
  page,
  impressions,
  position,
  clicks: 0,
});

describe("opportunity scoring (2026-10-15)", () => {
  const rows = [
    row("channel letters houston", "/", 59, 21.7),
    row("channel letters houston", "/services/channel-letters", 4, 30),
    row("monument signs near me", "/services/monument-signs", 41, 9.2),
    row("city of houston sign administration", "/sign-permits", 300, 6.9),
    row("led signs for business houston", "/services/channel-letters", 30, 48),
    row("houston sign crafters", "/", 500, 1.2), // brand
    row("custom banners houston", "/", 200, 15), // off focus
    row("sign permit houston", "/sign-permits", 80, 2.1), // already winning
    row("tiny query", "/sign-permits", 3, 12), // too few impressions
  ];

  it("routes ranking pages to improvements and unranked searches to articles", () => {
    const opps = rankOpportunities(rows, SITE);
    const by = Object.fromEntries(opps.map((o) => [o.query, o]));
    expect(by["monument signs near me"].kind).toBe("improve_page");
    expect(by["city of houston sign administration"].targetPage).toBe("/sign-permits");
    expect(by["led signs for business houston"].kind).toBe("new_article");
    expect(by["houston sign crafters"]).toBeUndefined();
    expect(by["custom banners houston"]).toBeUndefined();
    expect(by["sign permit houston"]).toBeUndefined();
    expect(by["tiny query"]).toBeUndefined();
  });

  it("when the homepage outranks a matching service page, the service page is the target", () => {
    const opp = rankOpportunities(rows, SITE).find((o) => o.query === "channel letters houston")!;
    expect(opp.rankingPage).toBe("/");
    expect(opp.targetPage).toBe("/services/channel-letters");
  });

  it("focus products weigh more than generic searches at the same volume", () => {
    const opps = rankOpportunities(
      [row("pylon sign cost", "/sign-permits", 50, 12), row("sign permit fee", "/sign-permits", 50, 12)],
      SITE
    );
    expect(opps[0].query).toBe("pylon sign cost");
  });

  it("picks one page, skipping the homepage and pages improved in the last 4 weeks", () => {
    const opps = rankOpportunities(rows, SITE);
    const first = pickImprovementTarget(opps, []);
    expect(first?.page).toBe("/sign-permits");
    expect(first?.queries[0].query).toBe("city of houston sign administration");
    const next = pickImprovementTarget(opps, ["/sign-permits"]);
    expect(next?.page).not.toBe("/sign-permits");
    expect(next?.page).not.toBe("/");
  });

  it("orders city pages by real search demand, product matches weighted up", () => {
    const combos = ["Katy × Pylon Signs", "The Woodlands × Monument Signs", "Pearland × Monument Signs"];
    const demand = comboDemand(
      [row("monument signs woodlands tx", "/", 20, 15), row("sign company pearland", "/", 25, 18)],
      combos
    );
    expect(demand.get("The Woodlands × Monument Signs")).toBe(60);
    expect(orderCombosByDemand(combos, demand)).toEqual([
      "The Woodlands × Monument Signs",
      "Pearland × Monument Signs",
      "Katy × Pylon Signs",
    ]);
  });

  it("reads a live page's main text and headings for the improvement prompt", () => {
    const page = extractPageText(
      "<header>nav</header><main><h1>Sign permits</h1><p>Houston &amp; suburbs.</p><script>x</script></main>"
    );
    expect(page.headings).toEqual(["Sign permits"]);
    expect(page.text).toBe("Sign permits Houston & suburbs.");
  });
});
