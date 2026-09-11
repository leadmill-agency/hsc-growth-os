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

export async function saveAccountResearchBrief(
  db: Db,
  input: { accountId: string; ploybookRunId?: string; brief: AccountResearchBrief }
) {
  await saveEvidence(db, {
    entityType: "account",
    entityId: input.accountId,
    fieldName: "research_brief",
    value: input.brief,
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
