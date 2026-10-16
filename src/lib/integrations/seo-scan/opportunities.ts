import type { QueryPageRow } from "@/lib/integrations/gsc/client";
import { pagePath } from "@/lib/integrations/gsc/client";

// Opportunity-driven SEO targeting (Rameel 2026-10-15: "build it that way").
// The first version of the weekly scan wrote an article for the first gap
// query in the list, even when a page already ranked for it, so its drafts
// competed with the site's own pages (2 of 4 backlog drafts were skipped for
// that). Now every gap is scored and routed:
//   - a page already ranks 4th–30th  → IMPROVE that page (fastest gains)
//   - nothing ranks in the top 30    → NEW ARTICLE
//   - the homepage outranks a matching service page → improve the SERVICE
//     page, so it takes over the query (the baseline "channel letters
//     houston" conflict, 9/25)
// City × product pages are ordered by real search demand, not list order.

const BRAND = /sign ?crafters|\bhsc\b/i;

/** Gap queries about off-focus, low-ticket work never get pages or articles. */
export const OFF_FOCUS = /banner|vinyl|wrap|decal|wall graphic|yard sign|magnet|sticker|print|flag|poster|plaque|dedication/i;

// Product focus (Rameel 2026-10-15). Matching queries weigh 1.5×.
const FOCUS =
  /channel letter|storefront|pylon|pole sign|monument|repair|reface|retrofit|awning|canopy|canopies|interior|lobby|\bada\b|acrylic|sign company|sign companies|sign shop|sign maker|business sign|building sign/i;

/** Query → the service page that should own it (homepage retarget). */
const SERVICE_FOR_QUERY: [RegExp, string][] = [
  [/channel letter/i, "/services/channel-letters"],
  [/storefront/i, "/services/storefront-signs"],
  [/monument/i, "/services/monument-signs"],
  [/pylon|pole sign/i, "/services/pole-signs"],
  [/repair|reface|retrofit/i, "/services/sign-repair"],
  [/awning|canopy|canopies/i, "/services/awnings-canopies"],
  [/interior|lobby|\bada\b/i, "/services/interior-signs"],
];

export interface Opportunity {
  query: string;
  impressions: number;
  clicks: number;
  /** Position of the best-ranking page for this query (impression-weighted). */
  position: number;
  rankingPage: string | null;
  kind: "improve_page" | "new_article";
  /** The page to improve (may differ from rankingPage — homepage retarget). */
  targetPage: string | null;
  reason: string;
  score: number;
}

function closeness(position: number): number {
  if (position <= 10) return 1;
  if (position <= 20) return 0.8;
  if (position <= 30) return 0.5;
  return 0.3;
}

/** Score and route every non-brand, on-focus search the site shows up for. */
export function rankOpportunities(
  rows: QueryPageRow[],
  sitemapUrls: string[],
  opts: { minImpressions?: number } = {}
): Opportunity[] {
  const minImpressions = opts.minImpressions ?? 10;
  const sitePaths = new Set(sitemapUrls.map(pagePath));
  const byQuery = new Map<string, QueryPageRow[]>();
  for (const r of rows) {
    if (!r.query || BRAND.test(r.query) || OFF_FOCUS.test(r.query)) continue;
    const list = byQuery.get(r.query) ?? [];
    list.push(r);
    byQuery.set(r.query, list);
  }

  const out: Opportunity[] = [];
  for (const [query, list] of byQuery) {
    const impressions = list.reduce((a, r) => a + r.impressions, 0);
    if (impressions < minImpressions) continue;
    const clicks = list.reduce((a, r) => a + r.clicks, 0);
    // Best page = the one Google shows most for this query.
    const best = [...list].sort((a, b) => b.impressions - a.impressions || a.position - b.position)[0];
    const position = Math.round(best.position * 10) / 10;
    if (position <= 3) continue; // already winning

    const focus = FOCUS.test(query) ? 1.5 : 1;
    const score = Math.round(impressions * closeness(position) * focus * 10) / 10;

    if (position <= 30) {
      let targetPage = best.page;
      let reason = `${best.page} ranks ${position} for "${query}" (${impressions} impressions)`;
      if (best.page === "/") {
        const service = SERVICE_FOR_QUERY.find(([re, path]) => re.test(query) && sitePaths.has(path));
        if (service) {
          targetPage = service[1];
          reason = `the homepage ranks ${position} for "${query}"; strengthen ${service[1]} so it takes over`;
        }
      }
      out.push({ query, impressions, clicks, position, rankingPage: best.page, kind: "improve_page", targetPage, reason, score });
    } else {
      out.push({
        query,
        impressions,
        clicks,
        position,
        rankingPage: best.page,
        kind: "new_article",
        targetPage: null,
        reason: `no page ranks in the top 30 for "${query}" (best ${position})`,
        score,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface ImprovementTarget {
  page: string;
  score: number;
  queries: { query: string; impressions: number; position: number }[];
  reasons: string[];
}

/**
 * The single page to improve this week: the target page with the highest
 * combined score, skipping pages improved recently (give Google time to react)
 * and the homepage, which other sessions edit often and is better served by
 * strengthening service pages.
 */
export function pickImprovementTarget(
  opps: Opportunity[],
  recentlyImproved: string[]
): ImprovementTarget | null {
  const byPage = new Map<string, Opportunity[]>();
  for (const o of opps) {
    if (o.kind !== "improve_page" || !o.targetPage) continue;
    if (o.targetPage === "/" || recentlyImproved.includes(o.targetPage)) continue;
    const list = byPage.get(o.targetPage) ?? [];
    list.push(o);
    byPage.set(o.targetPage, list);
  }
  let best: ImprovementTarget | null = null;
  for (const [page, list] of byPage) {
    const score = Math.round(list.reduce((a, o) => a + o.score, 0) * 10) / 10;
    if (!best || score > best.score) {
      const top = [...list].sort((a, b) => b.score - a.score).slice(0, 6);
      best = {
        page,
        score,
        queries: top.map((o) => ({ query: o.query, impressions: o.impressions, position: o.position })),
        reasons: top.map((o) => o.reason),
      };
    }
  }
  return best;
}

// City demand: impressions of searches naming each city. Variants catch how
// people actually type them ("woodlands", "sugarland").
const CITY_VARIANTS: Record<string, RegExp> = {
  "The Woodlands": /woodlands/i,
  "Sugar Land": /sugar ?land/i,
  "League City": /league city/i,
  "Missouri City": /missouri city/i,
};

const PRODUCT_PATTERNS: Record<string, RegExp> = {
  "Channel Letter Signs": /channel letter|storefront/i,
  "Pylon Signs": /pylon|pole sign/i,
  "Monument Signs": /monument/i,
  "Sign Repair": /repair|reface|retrofit/i,
  "Commercial Awnings": /awning|canopy|canopies/i,
};

/**
 * Demand score per "City × Product" combo: impressions for searches naming the
 * city, with searches naming both the city AND the product counting triple.
 */
export function comboDemand(rows: QueryPageRow[], combos: string[]): Map<string, number> {
  const impByQuery = new Map<string, number>();
  for (const r of rows) {
    if (BRAND.test(r.query)) continue;
    impByQuery.set(r.query, (impByQuery.get(r.query) ?? 0) + r.impressions);
  }
  const demand = new Map<string, number>();
  for (const combo of combos) {
    const [geo, product] = combo.split("×").map((s) => s.trim());
    const cityRe = CITY_VARIANTS[geo] ?? new RegExp(`\\b${geo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const productRe = PRODUCT_PATTERNS[product];
    let score = 0;
    for (const [q, imp] of impByQuery) {
      if (!cityRe.test(q)) continue;
      score += productRe && productRe.test(q) ? imp * 3 : imp;
    }
    demand.set(combo, score);
  }
  return demand;
}

/** Combos by demand, highest first; ties keep the curated list order. */
export function orderCombosByDemand(combos: string[], demand: Map<string, number>): string[] {
  return combos
    .map((c, i) => ({ c, i, d: demand.get(c) ?? 0 }))
    .sort((a, b) => b.d - a.d || a.i - b.i)
    .map((x) => x.c);
}
