import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { accounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLLMClient } from "@/lib/ai/client";
import { getResearchProvider } from "@/lib/integrations/research/provider";
import { saveEvidence } from "./entities";
import { logActivity } from "@/lib/events";

// PB09 — Account Research Brief: one reusable research object per account.
// Live research (OpenAI web search) → structured extraction (LLMClient) → evidence writebacks.
// Unknowns stay unknowns (§5.4); nothing is invented to fill a section.

export const evidenceStatus = z.enum(["verified", "inferred", "assumed", "unknown"]);

export const researchBriefSchema = z.object({
  company: z.object({
    summary: z.string(),
    headquarters: z.string().nullable(),
    size: z.string().nullable(),
    markets: z.array(z.string()),
    houston_presence: z.string().nullable(),
    // The company's own site — Hunter needs a domain to find anyone's email.
    official_website: z.string().nullable(),
  }),
  hsc_fit: z.object({
    relevant_products: z.array(z.string()),
    potential_spend: z.string().nullable(),
    repeatability: z.string().nullable(),
  }),
  people: z.array(
    z.object({
      name: z.string(),
      title: z.string().nullable(),
      role_type: z.string(),
      why_relevant: z.string(),
      status: evidenceStatus,
    })
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      location: z.string().nullable(),
      stage: z.string().nullable(),
      relevance: z.string(),
      status: evidenceStatus,
    })
  ),
  signals: z.array(z.string()),
  recommended_motion: z.string(),
  unknowns: z.array(z.string()),
});

export type ResearchBrief = z.infer<typeof researchBriefSchema>;

export async function researchAccountBrief(
  db: Db,
  params: {
    accountId: string;
    accountName: string;
    website?: string | null;
    projectContext?: string;
    ploybookRunId?: string;
  }
): Promise<{ brief: ResearchBrief; sources: { url: string; title?: string }[] }> {
  const provider = await getResearchProvider();
  const llm = getLLMClient();

  const query =
    `Research the company "${params.accountName}"` +
    (params.website ? ` (website: ${params.website})` : "") +
    `. I need: what they do, headquarters, size, markets, Houston/Texas presence, ` +
    `current construction projects (especially Houston/Texas), key preconstruction/estimating/` +
    `procurement people, vendor or subcontractor prequalification requirements, and any recent ` +
    `news or expansion signals.` +
    (params.projectContext ? ` Context for this pursuit: ${params.projectContext}` : "");

  const research = await provider.research({
    query,
    focus: "commercial signage/awning vendor evaluating this company as a customer",
  });

  const brief = await llm.generateStructured({
    system:
      "You extract a structured account research brief for Houston Sign Crafters (commercial " +
      "signs and awnings, Houston TX). Use ONLY the research text provided. Mark each person and " +
      "project with status: verified (explicit in research with source), inferred (strongly " +
      "implied), assumed, or unknown. Anything the research does not establish goes in unknowns. " +
      "official_website: the company's OWN site when the research/sources show it (not " +
      "LinkedIn, Yelp, or news) — null if unclear. Never invent names, projects, or figures.",
    prompt:
      `RESEARCH FINDINGS:\n${research.text}\n\nSOURCES:\n` +
      research.sources.map((s) => s.url).join("\n") +
      `\n\nProduce the account research brief for ${params.accountName}.`,
    schema: researchBriefSchema,
    effort: "medium",
  });

  // Writeback: structured fields + evidence rows, not just prose (PB09 §Writeback).
  await db
    .update(accounts)
    .set({
      notes: brief.company.summary,
      headquarters: brief.company.headquarters ?? undefined,
      ...(brief.company.official_website
        ? {
            website: brief.company.official_website,
            domain: brief.company.official_website
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .split("/")[0],
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, params.accountId));

  for (const field of ["summary", "houston_presence"] as const) {
    const value = field === "summary" ? brief.company.summary : brief.company.houston_presence;
    if (value) {
      await saveEvidence(db, {
        entityType: "account",
        entityId: params.accountId,
        fieldName: field,
        value,
        sourceName: "pb09_research",
        sourceUrl: research.sources[0]?.url,
        confidence: 0.7,
        verificationStatus: "inferred",
      });
    }
  }

  await logActivity(db, {
    entityType: "account",
    entityId: params.accountId,
    action: "research.brief_completed",
    detail: `${brief.people.length} people, ${brief.projects.length} projects, ${brief.unknowns.length} unknowns`,
    ploybookRunId: params.ploybookRunId,
  });

  return { brief, sources: research.sources };
}
