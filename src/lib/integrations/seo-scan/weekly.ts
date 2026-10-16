import type { Db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import {
  fetchSitemapUrls,
  findCoveringUrls,
  findTopicCoveringUrls,
  topicsOverlap,
} from "@/lib/integrations/website/sitemap";
import {
  comboDemand,
  orderCombosByDemand,
  pickImprovementTarget,
  rankOpportunities,
} from "./opportunities";

// Weekly SEO + content scan (per Rameel 2026-09-18): every Monday morning the
// system drafts ONE new city × product landing page (PB16) and ONE buyer-question
// article (PB17). Both land as publish approvals on the Researched tab — nothing
// goes on the website until a human approves and commits it. Targets are picked
// from curated lists, skipping anything the live sitemap already covers and
// anything a prior run already drafted.
//
// 2026-10-15 (Rameel: "build it that way"): targeting is now driven by Search
// Console query × page data (opportunities.ts). Each week also drafts ONE
// improvement to a page that already ranks 4th–30th (PB17b), new articles only
// go to searches nothing ranks for, and city pages are ordered by demand.

// Cities in HSC's real service area, highest-value first. The site's existing
// /locations pages are general city pages — a city × product page is new inventory.
export const SEO_GEOGRAPHIES = [
  "Katy",
  "Sugar Land",
  "The Woodlands",
  "Pearland",
  "Cypress",
  "Spring",
  "Pasadena",
  "Richmond",
  "Missouri City",
  "League City",
  "Conroe",
  "Humble",
  "Baytown",
  "Tomball",
  "Stafford",
  "Webster",
  "Friendswood",
  "Rosenberg",
];

// Business focus (Rameel 2026-09-19): exterior signage with $4k+ average
// orders — pole/pylon, monument, storefront/channel letters. Banners, wall
// vinyl, and vehicle wraps are outsourced pass-throughs and never get pages
// or articles from this scan.
// Product focus per Rameel 2026-10-15: storefront/channel letters, pylon and
// pole, monument, repair, awnings, plus interior, ADA, and flat acrylic
// letters (those three sell best inside a package, so they get articles, not
// city pages). Storefront Signs stays OUT of the city matrix: a city ×
// storefront page twins the city × channel letters page (the 9/28 Katy draft).
export const SEO_PRODUCTS = [
  "Channel Letter Signs",
  "Pylon Signs",
  "Monument Signs",
  "Sign Repair",
  // Growth line per Rameel 2026-09-19 — statewide service area, GC-bid heavy,
  // fabricated in-house like signs (Rameel corrected this 2026-09-19).
  "Commercial Awnings",
];

/** Gap queries about outsourced, low-ticket work are never worth an article. */
export const OFF_FOCUS_PATTERN =
  /banner|vinyl|wrap|decal|wall graphic|yard sign|magnet|sticker|print|flag|poster/i;

// Fallback topic backlog (per Rameel 2026-09-19 the PRIMARY topic source is
// live GSC content gaps — queries the site already gets impressions for but
// ranks poorly on; this list only feeds weeks where GSC has no usable gap).
// Real buyer questions and objections, roughly in search-demand order. Each
// becomes one PB17 article; figures stay out unless a human confirms them.
export const CONTENT_TOPICS = [
  "Do I need a permit for a business sign in Houston?",
  "How much do channel letter signs cost? What drives the price?",
  "Monument sign vs pylon sign: which is right for your business?",
  "How long does it take to get a business sign made and installed?",
  "What is a UL-listed sign and why does it matter?",
  "Sign permit rules: City of Houston vs unincorporated Harris County",
  "Landlord sign criteria: what tenants need to know before ordering a storefront sign",
  "Can you reface an existing sign instead of replacing it?",
  "LED vs neon signs for storefronts",
  "How tall can a pole sign be in the Houston area?",
  "How Houston wind load requirements affect sign design",
  "Sign repair in Houston: repair, reface, or replace?",
  "Is an LED retrofit worth it for an older sign?",
  "Do commercial awnings need a permit in Texas?",
  "Fabric awning vs metal canopy for a commercial building",
  "Walkway canopies for schools and churches: what does the project involve?",
  "How to choose a sign company for a commercial project",
  // Interior and ADA joined the focus 2026-10-15 (sold best inside a package).
  "ADA signs for commercial buildings in Texas: what the rules require",
  "Lobby signs: lit vs non-lit, and what each costs to run",
  "Flat acrylic letters vs channel letters: which does your space need?",
  "One sign company for the whole building: exterior, interior, and ADA",
];

/** Diagonal traversal of the city × product grid so early weeks vary both axes. */
export function seoMatrixCombos(): string[] {
  const combos: string[] = [];
  for (let s = 0; s <= SEO_GEOGRAPHIES.length + SEO_PRODUCTS.length - 2; s++) {
    for (let ci = 0; ci < SEO_GEOGRAPHIES.length; ci++) {
      const pi = s - ci;
      if (pi >= 0 && pi < SEO_PRODUCTS.length) {
        combos.push(`${SEO_GEOGRAPHIES[ci]} × ${SEO_PRODUCTS[pi]}`);
      }
    }
  }
  return combos;
}

/**
 * Pure picker (testable): next uncovered, never-drafted targets.
 * Topic candidates are GSC content-gap queries first (real demand the site
 * already surfaces for), then the curated backlog. A candidate is skipped when
 * an existing page covers its keywords or a prior draft was a near-duplicate.
 */
export function pickNextSeoTargets(
  sitemapUrls: string[],
  priorInputs: { matrixInputs: string[]; topicInputs: string[] },
  gapQueries: string[] = [],
  opts: { comboOrder?: string[] } = {}
): { matrixInput: string | null; topicInput: string | null } {
  const matrixInput =
    (opts.comboOrder ?? seoMatrixCombos()).find((combo) => {
      if (priorInputs.matrixInputs.includes(combo)) return false;
      const [geo, product] = combo.split("×").map((s) => s.trim());
      return findCoveringUrls(sitemapUrls, [geo, product]).length === 0;
    }) ?? null;

  const onFocusGaps = gapQueries.filter((q) => !OFF_FOCUS_PATTERN.test(q));
  const topicInput =
    [...onFocusGaps, ...CONTENT_TOPICS].find((topic) => {
      if (priorInputs.topicInputs.some((prior) => topicsOverlap(prior, topic))) return false;
      return findTopicCoveringUrls(sitemapUrls, topic).length === 0;
    }) ?? null;

  return { matrixInput, topicInput };
}

/** Monday 00:00 UTC of the current week. */
export function startOfWeekUtc(now: Date = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d;
}

/** db.execute returns bare arrays on postgres-js and { rows } on PGlite. */
function asRows<T>(result: unknown): T[] {
  const r = result as { rows?: T[] };
  return r.rows ?? (result as T[]);
}

async function priorInputsFor(db: Db, key: string, field: string): Promise<string[]> {
  // Failed runs don't count — the same target may be retried next week.
  const rows = asRows<{ input: string | null }>(
    await db.execute(
      sql`select r.trigger_payload ->> ${field} as input
          from ploybook_runs r join ploybooks p on p.id = r.ploybook_id
          where p.key = ${key} and r.status != 'failed'`
    )
  );
  return rows.map((r) => r.input).filter((v): v is string => !!v);
}

async function ranSince(db: Db, key: string, since: Date): Promise<boolean> {
  const rows = asRows(
    await db.execute(
      sql`select 1 from ploybook_runs r join ploybooks p on p.id = r.ploybook_id
          where p.key = ${key} and r.status != 'failed' and r.created_at >= ${since.toISOString()}
          limit 1`
    )
  );
  return rows.length > 0;
}

/**
 * Launch this week's PB16 + PB17 drafts if they haven't run since Monday.
 * Returns a human-readable log of what happened.
 */
export async function runWeeklySeoScan(db: Db, opts: { force?: boolean } = {}): Promise<string[]> {
  const log: string[] = [];
  const weekStart = startOfWeekUtc();
  const sitemapUrls = await fetchSitemapUrls();
  const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
  await import("@/lib/ploybooks");

  // Live demand first. Search Console query × page rows are scored: searches a
  // page already ranks 4th–30th for become a page improvement; searches nothing
  // ranks for become article candidates; city mentions order the city pages.
  // If GSC is unreachable, the curated lists carry the week.
  let gapQueries: string[] = [];
  let comboOrder: string[] | undefined;
  let improvement: ReturnType<typeof pickImprovementTarget> = null;
  try {
    const { fetchQueryPageRows } = await import("@/lib/integrations/gsc/client");
    const rows = await fetchQueryPageRows({ days: 28 });
    const opps = rankOpportunities(rows, sitemapUrls);
    gapQueries = opps.filter((o) => o.kind === "new_article").map((o) => o.query);
    comboOrder = orderCombosByDemand(seoMatrixCombos(), comboDemand(rows, seoMatrixCombos()));
    improvement = pickImprovementTarget(opps, await recentImprovementTargets(db));
    log.push(
      `GSC: ${opps.length} scored opportunities (${opps.filter((o) => o.kind === "improve_page").length} page improvements, ${gapQueries.length} article gaps)` +
        (opps[0] ? `; top "${opps[0].query}" (${opps[0].reason})` : "")
    );
  } catch (err) {
    log.push(`GSC unavailable (${err instanceof Error ? err.message : err}) — using curated lists`);
  }

  const targets = pickNextSeoTargets(
    sitemapUrls,
    {
      matrixInputs: await priorInputsFor(db, "pb16_local_seo", "matrixInput"),
      topicInputs: await priorInputsFor(db, "pb17_content_builder", "topicInput"),
    },
    gapQueries,
    { comboOrder }
  );

  if (!opts.force && (await ranSince(db, "pb16_local_seo", weekStart))) {
    log.push("PB16: already ran this week, skipping");
  } else if (!targets.matrixInput) {
    log.push("PB16: no uncovered city × product target left in the list");
  } else {
    const runId = await launchRun(db, {
      ploybookKey: "pb16_local_seo",
      triggerType: "scheduled",
      triggerPayload: { matrixInput: targets.matrixInput },
      initiatedBy: "system",
    });
    await executeRun(db, runId);
    log.push(`PB16: drafted "${targets.matrixInput}" (run ${runId})`);
  }

  if (!opts.force && (await ranSince(db, "pb17_content_builder", weekStart))) {
    log.push("PB17: already ran this week, skipping");
  } else if (!targets.topicInput) {
    log.push("PB17: no unwritten topic left in the backlog");
  } else {
    const runId = await launchRun(db, {
      ploybookKey: "pb17_content_builder",
      triggerType: "scheduled",
      triggerPayload: { topicInput: targets.topicInput },
      initiatedBy: "system",
    });
    await executeRun(db, runId);
    log.push(`PB17: drafted "${targets.topicInput}" (run ${runId})`);
  }

  // PB17b: improve the page with the most ranking upside this week.
  if (!opts.force && (await ranSince(db, "pb17_page_improver", weekStart))) {
    log.push("PB17b: already ran this week, skipping");
  } else if (!improvement) {
    log.push("PB17b: no page in positions 4–30 worth improving this week");
  } else {
    const runId = await launchRun(db, {
      ploybookKey: "pb17_page_improver",
      triggerType: "scheduled",
      triggerPayload: {
        targetPage: improvement.page,
        queries: improvement.queries,
        reasons: improvement.reasons,
      },
      initiatedBy: "system",
    });
    await executeRun(db, runId);
    log.push(`PB17b: drafted an improvement for ${improvement.page} (score ${improvement.score}, run ${runId})`);
  }

  // One scan per week, even when a step had nothing to draft (otherwise the
  // 15-minute scheduler would retry all week).
  const { emitEvent } = await import("@/lib/events");
  await emitEvent(db, { eventType: "seo.weekly_scan_ran", payload: { log } });
  return log;
}

/** Pages improved in the last 4 weeks — give Google time to react before touching them again. */
async function recentImprovementTargets(db: Db): Promise<string[]> {
  const since = new Date(Date.now() - 28 * 864e5).toISOString();
  const rows = asRows<{ page: string | null }>(
    await db.execute(
      sql`select r.trigger_payload ->> 'targetPage' as page
          from ploybook_runs r join ploybooks p on p.id = r.ploybook_id
          where p.key = 'pb17_page_improver' and r.status != 'failed' and r.created_at >= ${since}`
    )
  );
  return rows.map((r) => r.page).filter((v): v is string => !!v);
}

/** True when the weekly scan still owes a run for the current week. */
export async function weeklySeoScanDue(db: Db): Promise<boolean> {
  const weekStart = startOfWeekUtc();
  const rows = asRows(
    await db.execute(
      sql`select 1 from events where event_type = 'seo.weekly_scan_ran'
          and occurred_at >= ${weekStart.toISOString()} limit 1`
    )
  );
  return rows.length === 0;
}
