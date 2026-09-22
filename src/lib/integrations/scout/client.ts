import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import { emitEvent } from "@/lib/events";
import { events } from "@/lib/db/schema";
import { and, eq, gte } from "drizzle-orm";

// Expansion Scout (radar PRD §5 discovery themes, per Rameel 2026-09-10: "you
// scanning online IS the value add"). Every morning it web-searches a rotating
// subset of themes, extracts concrete expansion discoveries, and feeds each into
// PB05 — which dedupes, scores, and (via auto-pursue routing) kicks off the
// right playbook. Cost guardrails: N queries/day, capped signals; recurring
// finds are cheap no-ops thanks to entity dedupe.

export const SCOUT_THEMES: { key: string; query: string }[] = [
  // Slimmed 6 → 4 themes (Rameel 2026-09-21: cost) — the two cut themes'
  // coverage is folded into these, and each theme runs a minute apart.
  {
    key: "franchise_tx",
    query:
      "Franchise brands announcing GREATER HOUSTON locations or Houston-market entry in the last 30 days: development agreements, multi-unit deals, or first Houston-area locations (within ~50 miles of downtown Houston — Katy, Sugar Land, The Woodlands, Conroe, Pearland, Baytown, Galveston). Restaurant, fitness, health, retail, car wash brands. Skip Dallas, Austin, and San Antonio news unless it names a Houston-area site.",
  },
  {
    key: "multi_location_operators",
    query:
      "Chains and multi-location operators committing to MULTIPLE Greater Houston locations (within ~50 miles of downtown Houston) in the last 30 days: urgent care, dental groups, gyms, car washes, gas stations, restaurants — area development agreements, several signed leases, market-entry announcements naming Houston-area sites. Skip single-location independent openings and skip Dallas/Austin/San Antonio-only news.",
  },
  {
    key: "developments",
    query:
      "New commercial developments announced or breaking ground in Greater Houston and its growth corridors (Katy, Richmond, Cypress, Conroe, Baytown, Pearland) in the last 30 days: retail centers, mixed-use, medical, grocery-anchored projects — developer names, anchor tenants, locations. Skip individual small-business openings.",
  },
  {
    key: "rebrands_acquisitions",
    query:
      "Acquisitions or rebrands hitting GREATER HOUSTON multi-location businesses in the last 30 days: chains with Houston-area stores being acquired or renamed, banner conversions, healthcare or retail rebrand programs affecting locations within ~50 miles of Houston.",
  },
];

const scoutExtractionSchema = z.object({
  discoveries: z.array(
    z.object({
      company_name: z.string(),
      category: z.enum(["franchise", "development", "portfolio_operator", "gc_project", "other"]),
      headline: z.string(),
      texas_scale: z.string().nullable(),
      houston_relevance: z.string().nullable(),
      source_url: z.string().nullable(),
      status: z.enum(["verified", "inferred", "assumed"]),
    })
  ),
});

export async function scoutRanToday(db: Db): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await db.query.events.findFirst({
    where: and(eq(events.eventType, "radar.scout_ran"), gte(events.occurredAt, startOfDay)),
  });
  return !!row;
}

export interface ScoutOptions {
  maxQueries?: number; // themes per day (rotating)
  maxSignals?: number; // discoveries fed to PB05 per day
}

export async function runExpansionScout(db: Db, opts: ScoutOptions = {}) {
  const maxQueries = opts.maxQueries ?? 3;
  const maxSignals = opts.maxSignals ?? 8;
  const provider = await getResearchProvider();
  const llm = getLLMClient();
  const { launchRun, executeRun } = await import("@/lib/ploybooks/runner");
  await import("@/lib/ploybooks");

  // Rotate themes by day so the week covers all of them within the daily budget.
  const dayIndex = Math.floor(Date.now() / 86400000);
  const themes: typeof SCOUT_THEMES = [];
  for (let i = 0; i < Math.min(maxQueries, SCOUT_THEMES.length); i++) {
    themes.push(SCOUT_THEMES[(dayIndex + i) % SCOUT_THEMES.length]);
  }

  const results: { company: string; status: string }[] = [];
  let fed = 0;
  let themeIndex = 0;
  for (const theme of themes) {
    // A minute between theme queries (Rameel 2026-09-21) keeps the morning
    // burst under OpenAI's tokens-per-minute ceiling. Skipped under tests.
    if (themeIndex++ > 0 && !process.env.VITEST) {
      await new Promise((r) => setTimeout(r, 60_000));
    }
    const research = await provider.research({
      query: theme.query,
      focus:
        "concrete, current expansion signals for a Houston commercial sign company — company names, locations, timing, sources",
    });
    const extraction = await llm.generateStructured({
      system:
        "Extract concrete expansion discoveries from the research. The owner hunts ENTERPRISE " +
        "relationships: franchise deals, multi-unit commitments, developments, system rebrands. " +
        "SKIP single-location independent openings — one boutique opening one store is not a " +
        "discovery. Only companies the research " +
        "actually names with a real expansion signal; status verified (explicit with source), " +
        "inferred (strongly implied), or assumed (weak — will be discarded). Never invent " +
        "companies or figures.",
      prompt: `RESEARCH:\n${research.text.slice(0, 15000)}\n\nSOURCES:\n${research.sources
        .map((s) => s.url)
        .join("\n")}\n\nExtract the discoveries.`,
      schema: scoutExtractionSchema,
      effort: "low",
    });
    for (const d of extraction.discoveries) {
      if (fed >= maxSignals) break;
      if (d.status === "assumed") continue;
      const signalText =
        `Web scout discovery (${theme.key}): ${d.company_name} — ${d.headline}. ` +
        (d.texas_scale ? `Texas scale: ${d.texas_scale}. ` : "") +
        (d.houston_relevance ? `Houston relevance: ${d.houston_relevance}. ` : "") +
        `Category: ${d.category}.`;
      const runId = await launchRun(db, {
        ploybookKey: "pb05_opportunity_radar",
        triggerType: "scheduled",
        triggerPayload: { signalText, sourceUrl: d.source_url ?? undefined, source: "web_scout" },
        initiatedBy: "system",
      });
      const status = await executeRun(db, runId);
      results.push({ company: d.company_name, status });
      fed++;
    }
  }
  await emitEvent(db, {
    eventType: "radar.scout_ran",
    payload: { themes: themes.map((t) => t.key), discoveries: results },
  });
  return results;
}
