import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema";
import { getLLMClient } from "@/lib/ai/client";
import type { ResearchBrief } from "./research";
import { logActivity } from "@/lib/events";

// Shared actions: stakeholder mapping, vendor-readiness checklist, outreach drafting.
// Messaging rules (master PRD §17): ≤150 words, direct, evidence of research, one CTA,
// no generic flattery, and copy must match HSC's real sales process.

export const stakeholderPlanSchema = z.object({
  roles_needed: z.array(
    z.object({
      role_type: z.string(),
      why: z.string(),
      found: z.boolean(),
    })
  ),
  people: z.array(
    z.object({
      name: z.string(),
      title: z.string().nullable(),
      role_type: z.string(),
      influence: z.number().min(0).max(100),
      message_angle: z.string(),
      status: z.enum(["verified", "inferred", "assumed", "unknown"]),
    })
  ),
  missing_roles: z.array(z.string()),
});

export type StakeholderPlan = z.infer<typeof stakeholderPlanSchema>;

export async function buildStakeholderMap(
  db: Db,
  params: {
    accountId: string;
    accountName: string;
    brief: ResearchBrief;
    ploybookRunId?: string;
  }
): Promise<StakeholderPlan> {
  const llm = getLLMClient();
  const plan = await llm.generateStructured({
    system:
      "You build a stakeholder map for a signage subcontractor pursuing a GC. Prefer " +
      "project-specific estimating/preconstruction contacts over senior executives (PB01 §9). " +
      "Use ONLY people from the research brief; never add names that are not in it. Roles worth " +
      "seeking: estimator, preconstruction, project_manager, procurement, project_executive. " +
      "Mark missing roles explicitly.",
    prompt:
      `Account: ${params.accountName}\n\nResearch brief people:\n` +
      JSON.stringify(params.brief.people) +
      `\n\nProjects:\n` +
      JSON.stringify(params.brief.projects) +
      `\n\nBuild the stakeholder map.`,
    schema: stakeholderPlanSchema,
    effort: "low",
  });

  for (const person of plan.people) {
    const [first, ...rest] = person.name.split(" ");
    await db.insert(contacts).values({
      accountId: params.accountId,
      firstName: first,
      lastName: rest.join(" ") || null,
      title: person.title,
      roleType: person.role_type,
      influenceScore: Math.round(person.influence),
      source: "pb01_research",
    });
  }

  await logActivity(db, {
    entityType: "account",
    entityId: params.accountId,
    action: "stakeholder_map.created",
    detail: `${plan.people.length} people, missing roles: ${plan.missing_roles.join(", ") || "none"}`,
    ploybookRunId: params.ploybookRunId,
  });

  return plan;
}

// Vendor-readiness checklist (PB01 §5.4): fixed HSC items; status is unknown until verified.
export const READINESS_ITEMS = [
  "W-9 (generated fresh per signup — HSC process)",
  "Certificate of Insurance (issued per GC at signup)",
  "UL certification documents",
  "References / past project list",
  "Trade codes / scope classification",
  "Bonding capacity (if required)",
  "GC vendor portal enrollment",
  "Prequalification form (GC-specific)",
] as const;

export interface ReadinessChecklist {
  items: { item: string; status: "ready" | "needs_action" | "unknown"; note?: string }[];
  blockers: string[];
}

export function buildReadinessChecklist(gcRequirementsFromResearch: string[]): ReadinessChecklist {
  const items: ReadinessChecklist["items"] = READINESS_ITEMS.map((item) => ({
    item,
    status: item.includes("W-9") || item.includes("Insurance") ? "needs_action" : "unknown",
    note: item.includes("W-9") || item.includes("Insurance") ? "generated per-GC at signup" : undefined,
  }));
  for (const req of gcRequirementsFromResearch) {
    items.push({ item: `GC-specific: ${req}`, status: "unknown" });
  }
  return { items, blockers: [] };
}

export const outreachDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  alternate_subject: z.string(),
  alternate_body: z.string(),
  target_contact: z.string().nullable(),
  rationale: z.string(),
  word_count: z.number(),
});

export type OutreachDraft = z.infer<typeof outreachDraftSchema>;

// The owner's real voice — two actual reply-getting emails + the pattern.
// Shared by every email-drafting prompt (outreach, swarm, follow-ups).
export const OWNER_VOICE =
  "WRITE IN THE OWNER'S REAL VOICE — these are actual emails he sent that got replies; " +
  "match their structure, rhythm, and plainness exactly:\n\n" +
  "EXAMPLE 1:\n" +
  "Hi Collins,\n\nThis is Ray with Houston Sign Crafters. I saw you and Joey signed the " +
  "Twisted Egg Shack Texas development agreement. We're a Houston-based commercial sign " +
  "manufacturer and handle permitting and installation as well.\n\nI saw Manvel and League " +
  "City are the first Houston-area stores. I wanted to find out who's handling the signage " +
  "package for those locations.\n\nWe'd love to quote one of the stores.\n\n" +
  "EXAMPLE 2:\n" +
  "Hi Christina!\n\nThis is Ray with Houston Sign Crafters. I saw you've been managing " +
  "several Mac Haik First Watch builds — specifically Leander, Bastrop and Creekside.\n\n" +
  "We manufacture and install commercial signage here in Houston. We handle all permitting, " +
  "fabrication, and installation in house.\n\nI also saw Mac Haik has the big Starbird " +
  "rollout coming into Texas.\n\nAre you the person who handles signage vendors for new " +
  "restaurant projects, or does someone else on your team manage that? I'd love to submit a " +
  "competitive bid for these projects as they roll out.\n\n" +
  "THE PATTERN: greet by first name · 'This is Ray with Houston Sign Crafters.' · ONE " +
  "specific verified fact showing homework ('I saw...') · a one-line capability statement · " +
  "the ask is a routing question (are YOU in charge of bidding out the sign package, or does " +
  "someone else handle that?) · soft close. FORMATTING: one thought per paragraph, one or two " +
  "short sentences each, blank line between paragraphs. JARGON BAN: never write like a " +
  "database or a brochure — no 'we specialize in', no 'registered with TDLR', no feature " +
  "lists; a person wrote this. Never promise instant quotes or mockups before a site survey.";

export async function draftOutreach(params: {
  accountName: string;
  projectName?: string;
  brief: ResearchBrief;
  stakeholders: StakeholderPlan;
}): Promise<OutreachDraft> {
  const llm = getLLMClient();
  return llm.generateStructured({
    system:
      "You draft cold outreach for Houston Sign Crafters: UL-certified sign manufacturer, built " +
      "in Houston, 5-year warranty, in-house permitting and installation. Sender signs as Ray. " +
      "WRITE IN THE OWNER'S REAL VOICE — these are actual emails he sent that got replies; " +
      "match their structure, rhythm, and plainness exactly:\n\n" +
      "EXAMPLE 1:\n" +
      "Hi Collins,\n\nThis is Ray with Houston Sign Crafters. I saw you and Joey signed the " +
      "Twisted Egg Shack Texas development agreement. We're a Houston-based commercial sign " +
      "manufacturer and handle permitting and installation as well.\n\nI saw Manvel and League " +
      "City are the first Houston-area stores. I wanted to find out who's handling the signage " +
      "package for those locations.\n\nWe'd love to quote one of the stores.\n\n" +
      "EXAMPLE 2:\n" +
      "Hi Christina!\n\nThis is Ray with Houston Sign Crafters. I saw you've been managing " +
      "several Mac Haik First Watch builds — specifically Leander, Bastrop and Creekside.\n\n" +
      "We manufacture and install commercial signage here in Houston. We handle all permitting, " +
      "fabrication, and installation in house.\n\nI also saw Mac Haik has the big Starbird " +
      "rollout coming into Texas.\n\nAre you the person who handles signage vendors for new " +
      "restaurant projects, or does someone else on your team manage that? I'd love to submit a " +
      "competitive bid for these projects as they roll out.\n\n" +
      "THE PATTERN: greet by first name · 'This is Ray with Houston Sign Crafters.' · ONE " +
      "specific verified fact showing homework ('I saw...') · a one-line capability statement · " +
      "a SECOND specific detail when the brief has one · THE ASK, always a routing question: " +
      "are YOU the person in charge of bidding out the sign package for this project, or does " +
      "a different department/person handle that? · soft close ('We'd love to quote...'). " +
      "FORMATTING: one thought per paragraph, ONE OR TWO SHORT SENTENCES each, with a blank " +
      "line between every paragraph — 4 to 6 short paragraphs, never a wall of text. " +
      "GREETING on its own line ('Hi Jarrod,'), blank line, then 'This is Ray...'. " +
      "HARD RULE — never reveal the plumbing: the brief you receive is full of database and " +
      "government wording (TDLR, TABS, filing, permit, certificate of occupancy, 'registered', " +
      "'listed as owner contact'). NONE of those words may appear in the email. You know about " +
      "the project; you never say HOW. Refer to the project only by what it IS and WHERE: " +
      "'your office/warehouse addition on FM 3083 in Conroe', 'the new location y'all are " +
      "opening in Katy'. Saying 'registered with TDLR' or 'listed on the filing' instantly " +
      "reads as a mail-merge robot and kills the reply. 120 words max. No " +
      "flattery, no marketing language. NEVER promise instant quotes or mockups before a site " +
      "survey — the real process is call, then survey, then mockup with itemized estimate. Use " +
      "only facts from the brief; if a fact is not verified, do not state it as fact. The " +
      "alternate is a different angle in the SAME voice. Set word_count to the body's actual " +
      "word count.",
    prompt:
      `Account: ${params.accountName}\nProject: ${params.projectName ?? "unknown"}\n\n` +
      `Brief:\n${JSON.stringify({
        company: params.brief.company,
        signals: params.brief.signals,
        projects: params.brief.projects,
      })}\n\nBest contact:\n${JSON.stringify(params.stakeholders.people[0] ?? null)}\n\n` +
      `Draft the bid-access email and the relationship alternate.`,
    schema: outreachDraftSchema,
    effort: "medium",
  });
}
