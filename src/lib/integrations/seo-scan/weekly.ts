import type { Db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import { fetchSitemapUrls, findCoveringUrls } from "@/lib/integrations/website/sitemap";

// Weekly SEO + content scan (per Rameel 2026-09-18): every Monday morning the
// system drafts ONE new city × product landing page (PB16) and ONE buyer-question
// article (PB17). Both land as publish approvals on the Researched tab — nothing
// goes on the website until a human approves and commits it. Targets are picked
// from curated lists, skipping anything the live sitemap already covers and
// anything a prior run already drafted.

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

// Products from the live site's service list (data/services.js), revenue order.
export const SEO_PRODUCTS = [
  "Channel Letter Signs",
  "Monument Signs",
  "Storefront Signs",
  "Vehicle Wraps",
];

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
  "What are ADA signage requirements for Texas businesses?",
  "How Houston wind load requirements affect sign design",
  "How to choose a sign company for a commercial project",
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

/** Pure picker (testable): next uncovered, never-drafted targets. */
export function pickNextSeoTargets(
  sitemapUrls: string[],
  priorInputs: { matrixInputs: string[]; topicInputs: string[] }
): { matrixInput: string | null; topicInput: string | null } {
  const matrixInput =
    seoMatrixCombos().find((combo) => {
      if (priorInputs.matrixInputs.includes(combo)) return false;
      const [geo, product] = combo.split("×").map((s) => s.trim());
      return findCoveringUrls(sitemapUrls, [geo, product]).length === 0;
    }) ?? null;

  const topicInput =
    CONTENT_TOPICS.find((topic) => {
      if (priorInputs.topicInputs.includes(topic)) return false;
      const slugGuess = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
      return !sitemapUrls.some((u) => u.includes(slugGuess));
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

  const targets = pickNextSeoTargets(sitemapUrls, {
    matrixInputs: await priorInputsFor(db, "pb16_local_seo", "matrixInput"),
    topicInputs: await priorInputsFor(db, "pb17_content_builder", "topicInput"),
  });

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

  return log;
}

/** True when the weekly scan still owes a run for the current week. */
export async function weeklySeoScanDue(db: Db): Promise<boolean> {
  const weekStart = startOfWeekUtc();
  return (
    !(await ranSince(db, "pb16_local_seo", weekStart)) ||
    !(await ranSince(db, "pb17_content_builder", weekStart))
  );
}
