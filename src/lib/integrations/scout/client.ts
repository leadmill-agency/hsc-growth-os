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
  {
    key: "franchise_tx",
    query:
      "Franchise brands announcing Texas expansion or development agreements in the last 30 days: new market entry, multi-unit deals, first Texas locations. Restaurant, fitness, health, retail, car wash brands.",
  },
  {
    key: "houston_openings",
    query:
      "Restaurant, retail, and fitness chains announcing new Houston-area locations in the last 30 days — openings planned, leases signed, construction starting.",
  },
  {
    key: "developments",
    query:
      "New commercial developments announced or breaking ground in Greater Houston in the last 30 days: retail centers, mixed-use, medical, grocery-anchored projects — developer names and locations.",
  },
  {
    key: "rebrands_acquisitions",
    query:
      "Acquisitions or rebrands affecting Texas multi-location businesses in the last 30 days: chains acquired and being renamed, banner conversions, healthcare or retail rebrand programs.",
  },
  {
    key: "multi_location_operators",
    query:
      "Multi-location operators expanding in Texas in the last 30 days: urgent care, dental groups, gyms, car washes, gas stations adding Texas or Houston sites.",
  },
  {
    key: "houston_corridors",
    query:
      "Commercial construction and tenant announcements in Houston growth corridors (Katy, Richmond, Cypress, Conroe, Baytown, Pearland) in the last 30 days.",
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
  for (const theme of themes) {
    const research = await provider.research({
      query: theme.query,
      focus:
        "concrete, current expansion signals for a Houston commercial sign company — company names, locations, timing, sources",
    });
    const extraction = await llm.generateStructured({
      system:
        "Extract concrete expansion discoveries from the research. Only companies the research " +
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
