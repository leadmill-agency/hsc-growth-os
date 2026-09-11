import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { saveEvidence } from "@/lib/actions/entities";
import type { ResearchBrief } from "@/lib/actions/research";
import type { PortfolioProfile } from "@/lib/ploybooks/pb04-facility-portfolio/definition";

// The account research brief (per Rameel 2026-09-11: "it should be a true
// research brief" — what the business is, where, footprint, signals — not a
// pile of internal facts). Every research playbook normalizes its own profile
// into THIS shape and saves it as one evidence row the UI renders whole.

export interface AccountResearchBrief {
  headline: string; // one line: what this business is
  about: string; // short paragraph
  footprint: string[]; // locations / markets / presence lines
  signals: string[]; // expansion & activity signals
  projects: { name: string; detail: string }[];
  recommendation: string | null; // how HSC should approach
  unknowns: string[];
  sources: string[];
  researchedBy: string; // ploybook key
}

// The reader-facing shape (per Rameel 2026-09-11: "almost like a presidential
// brief") — bottom line up front, whole sentences, written for the decision.
export interface ReadableBrief {
  bottom_line: string;
  who_they_are: string;
  whats_happening: string[];
  opportunity: string;
  how_to_approach: string;
  unknowns: string[];
  sources: string[];
  researchedBy: string;
}

const readableBriefSchema = z.object({
  bottom_line: z.string(),
  who_they_are: z.string(),
  whats_happening: z.array(z.string()),
  opportunity: z.string(),
  how_to_approach: z.string(),
  unknowns: z.array(z.string()),
});

/** Serialize the raw mapped brief as labeled plain text — models copy the
 *  vocabulary they're shown, so no JSON keys reach the prompt (PB18 lesson). */
function rawBriefAsText(raw: AccountResearchBrief): string {
  return [
    `COMPANY SUMMARY: ${raw.about}`,
    raw.footprint.length ? `PRESENCE / FOOTPRINT:\n${raw.footprint.map((f) => `- ${f}`).join("\n")}` : null,
    raw.signals.length ? `ACTIVITY & SIGNALS:\n${raw.signals.map((s) => `- ${s}`).join("\n")}` : null,
    raw.projects.length
      ? `PROJECTS SPOTTED:\n${raw.projects.map((p) => `- ${p.name}: ${p.detail}`).join("\n")}`
      : null,
    raw.recommendation ? `SUGGESTED APPROACH (from research): ${raw.recommendation}` : null,
    raw.unknowns.length ? `STILL UNKNOWN:\n${raw.unknowns.map((u) => `- ${u}`).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function composeReadableBrief(raw: AccountResearchBrief): Promise<ReadableBrief> {
  const { getLLMClient } = await import("@/lib/ai/client");
  const llm = getLLMClient();
  const composed = await llm.generateStructured({
    system:
      "You write one-page intelligence briefs for the owner of a Houston sign company, in the " +
      "style of a presidential daily brief: bottom line up front, complete plain-English " +
      "sentences a business owner reads aloud, no fragments, no registry/database speak. " +
      "Translate research artifacts into human judgment: 'no legal entity found under that " +
      "exact name' becomes 'this looks like a small local shop with little public footprint'. " +
      "Use ONLY facts in the material — never invent names, numbers, or projects; genuine gaps " +
      "go in unknowns. bottom_line: 1-2 sentences — what this company is and whether it is " +
      "worth HSC's time, stated plainly. who_they_are: 2-4 sentences on the business. " +
      "whats_happening: 2-5 bullets, each ONE complete sentence about current activity. " +
      "opportunity: 1-3 sentences on what sign/awning/canopy work is plausibly in play for " +
      "HSC (channel letters, monuments, storefront, wayfinding, awnings). how_to_approach: " +
      "1-2 concrete sentences (who to contact, with what angle). unknowns: short plain items.",
    prompt: `RAW RESEARCH MATERIAL:\n\n${rawBriefAsText(raw)}\n\nWrite the brief.`,
    schema: readableBriefSchema,
    effort: "medium",
  });
  return { ...composed, sources: raw.sources, researchedBy: raw.researchedBy };
}

export async function saveAccountResearchBrief(
  db: Db,
  input: { accountId: string; ploybookRunId?: string; brief: AccountResearchBrief }
) {
  // Compose the readable version; if composition fails (e.g. fixtures in
  // tests), the raw mapped brief still gets stored — never lose research.
  let value: ReadableBrief | AccountResearchBrief = input.brief;
  try {
    value = await composeReadableBrief(input.brief);
  } catch (err) {
    console.warn(`[research-brief] readable composition failed, storing raw: ${(err as Error).message.slice(0, 120)}`);
  }
  await saveEvidence(db, {
    entityType: "account",
    entityId: input.accountId,
    fieldName: "research_brief",
    value,
    sourceName: input.brief.researchedBy,
    verificationStatus: "inferred", // narrative synthesis; per-fact statuses live in the raw evidence
  });
}

/** PB01/PB09 — the general account ResearchBrief. */
export function briefFromResearch(
  brief: ResearchBrief,
  sources: string[],
  researchedBy: string
): AccountResearchBrief {
  return {
    headline: brief.company.summary.split(/(?<=\.)\s/)[0] ?? brief.company.summary,
    about: brief.company.summary,
    footprint: [
      brief.company.headquarters ? `Headquarters: ${brief.company.headquarters}` : null,
      brief.company.size ? `Size: ${brief.company.size}` : null,
      brief.company.markets.length ? `Markets: ${brief.company.markets.join(", ")}` : null,
      brief.company.houston_presence ? `Houston presence: ${brief.company.houston_presence}` : null,
    ].filter((s): s is string => !!s),
    signals: brief.signals,
    projects: brief.projects.map((p) => ({
      name: p.name,
      detail: [p.location, p.stage, p.relevance].filter(Boolean).join(" · "),
    })),
    recommendation:
      brief.recommended_motion +
      (brief.hsc_fit.relevant_products.length > 0
        ? ` HSC fit: ${brief.hsc_fit.relevant_products.join(", ")}.`
        : ""),
    unknowns: brief.unknowns,
    sources,
    researchedBy,
  };
}

/** PB04 — multi-location operator profile. */
export function briefFromPortfolio(
  profile: PortfolioProfile,
  recommendation: { motion?: string } | null,
  sources: string[]
): AccountResearchBrief {
  return {
    headline: profile.operator_summary.split(/(?<=\.)\s/)[0] ?? profile.operator_summary,
    about: profile.operator_summary,
    footprint: [
      `Category: ${profile.category}`,
      profile.houston_location_count != null
        ? `Houston locations: ${profile.houston_location_count}`
        : null,
      profile.texas_location_count != null ? `Texas locations: ${profile.texas_location_count}` : null,
      ...profile.known_locations
        .slice(0, 8)
        .map((l) => `${l.name}${l.city ? ` — ${l.city}` : ""}${l.address ? ` (${l.address})` : ""}`),
    ].filter((s): s is string => !!s),
    signals: [
      ...profile.activity_signals,
      profile.incumbent_vendor_note ? `Incumbent vendor: ${profile.incumbent_vendor_note}` : null,
      `Service potential: ${profile.service_potential}`,
    ].filter((s): s is string => !!s),
    projects: [],
    recommendation: recommendation?.motion ?? null,
    unknowns: profile.unknowns,
    sources,
    researchedBy: "pb04_facility_portfolio",
  };
}

/** PB03 — franchise brand profile (loosely typed: schema lives in the playbook). */
export function briefFromBrand(
  profile: {
    brand_summary: string;
    franchisor?: string | null;
    texas_location_count?: number | null;
    houston_location_count?: number | null;
    announced_openings?: { location_name: string; city?: string | null; stage?: string | null; note?: string | null }[];
    franchisee_groups?: { name: string; territory?: string | null }[];
    unknowns?: string[];
  },
  recommendation: string | null,
  sources: string[]
): AccountResearchBrief {
  return {
    headline: profile.brand_summary.split(/(?<=\.)\s/)[0] ?? profile.brand_summary,
    about: profile.brand_summary,
    footprint: [
      profile.franchisor ? `Franchisor: ${profile.franchisor}` : null,
      profile.texas_location_count != null ? `Texas locations: ${profile.texas_location_count}` : null,
      profile.houston_location_count != null
        ? `Houston locations: ${profile.houston_location_count}`
        : null,
      ...(profile.franchisee_groups ?? []).map(
        (g) => `Franchisee group: ${g.name}${g.territory ? ` (${g.territory})` : ""}`
      ),
    ].filter((s): s is string => !!s),
    signals: (profile.announced_openings ?? []).map(
      (o) =>
        `Opening: ${o.location_name}${o.city ? `, ${o.city}` : ""}${o.stage ? ` — ${o.stage}` : ""}${o.note ? ` (${o.note})` : ""}`
    ),
    projects: [],
    recommendation,
    unknowns: profile.unknowns ?? [],
    sources,
    researchedBy: "pb03_franchise_expansion",
  };
}
