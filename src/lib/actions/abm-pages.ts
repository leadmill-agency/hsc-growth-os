import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { abmPages, interactions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";
import { slugify } from "./entities";

// PB07 — ABM page content model + engagement tracking.
// Pages are private (unguessable token, noindex) and draft until approved.

export const abmPageContentSchema = z.object({
  headline: z.string(),
  intro: z.string(),
  relevant_capabilities: z.array(z.object({ capability: z.string(), why_relevant: z.string() })),
  account_context: z.string(),
  proof_points: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      status: z.enum(["verified", "needs_real_project"]),
    })
  ),
  local_facts: z.array(z.string()),
  cta_label: z.string(),
  cta_detail: z.string(),
});

export type AbmPageContent = z.infer<typeof abmPageContentSchema>;

export async function createAbmPageDraft(
  db: Db,
  params: {
    accountId: string;
    accountName: string;
    opportunityId?: string;
    title: string;
    content: AbmPageContent;
    ploybookRunId?: string;
  }
) {
  const existing = await db.query.abmPages.findFirst({
    where: eq(abmPages.accountId, params.accountId),
  });
  if (existing) {
    const [updated] = await db
      .update(abmPages)
      .set({ title: params.title, content: params.content, status: "draft", updatedAt: new Date() })
      .where(eq(abmPages.id, existing.id))
      .returning();
    return { page: updated, created: false as const };
  }
  const [page] = await db
    .insert(abmPages)
    .values({
      accountId: params.accountId,
      opportunityId: params.opportunityId,
      slug: slugify(params.accountName),
      publicToken: randomBytes(16).toString("hex"),
      title: params.title,
      content: params.content,
    })
    .returning();
  await logActivity(db, {
    entityType: "account",
    entityId: params.accountId,
    action: "abm_page.drafted",
    detail: params.title,
    ploybookRunId: params.ploybookRunId,
  });
  return { page, created: true as const };
}

export async function publishAbmPage(db: Db, pageId: string) {
  const [page] = await db
    .update(abmPages)
    .set({ status: "published", updatedAt: new Date() })
    .where(eq(abmPages.id, pageId))
    .returning();
  await emitEvent(db, {
    eventType: "abm_page.published",
    accountId: page.accountId,
    payload: { pageId: page.id },
  });
  return page;
}

/** Record one page view: counter, interaction row, and domain event (PB07 tracking rules). */
export async function recordPageView(db: Db, token: string) {
  const page = await db.query.abmPages.findFirst({ where: eq(abmPages.publicToken, token) });
  if (!page || page.status !== "published") return null;
  await db
    .update(abmPages)
    .set({ viewCount: sql`${abmPages.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(abmPages.id, page.id));
  await db.insert(interactions).values({
    accountId: page.accountId,
    type: "website_visit",
    direction: "inbound",
    subject: `ABM page viewed: ${page.title}`,
    source: "abm_page",
    sourceId: page.id,
  });
  await emitEvent(db, {
    eventType: "account.page_viewed",
    accountId: page.accountId,
    payload: { pageId: page.id, viewCount: page.viewCount + 1 },
  });
  return page;
}
