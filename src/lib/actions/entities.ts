import type { Db } from "@/lib/db/client";
import { accounts, projects, opportunities, evidence, properties, relationships } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { logActivity } from "@/lib/events";

// Shared action library (master PRD §13) — CRM/workflow slice.
// Idempotent creation with dedupe (§33.10, §5.5): same normalized identity => same record.

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = input.includes("://") ? new URL(input) : new URL(`https://${input}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return input.replace(/^www\./, "").toLowerCase().trim() || null;
  }
}

/** Find-or-create an account. Dedupes by domain first, then slug. */
export async function createAccount(
  db: Db,
  input: {
    name: string;
    accountType?: string;
    website?: string;
    phone?: string;
    headquarters?: string;
    industry?: string;
    notes?: string;
    actor?: string;
    ploybookRunId?: string;
  }
) {
  const domain = normalizeDomain(input.website);
  if (domain) {
    const byDomain = await db.query.accounts.findFirst({ where: eq(accounts.domain, domain) });
    if (byDomain) return { account: byDomain, created: false as const };
  }
  const slug = slugify(input.name);
  const bySlug = await db.query.accounts.findFirst({ where: eq(accounts.slug, slug) });
  if (bySlug) return { account: bySlug, created: false as const };

  const [account] = await db
    .insert(accounts)
    .values({
      name: input.name,
      slug,
      accountType: input.accountType ?? "prospect",
      website: input.website,
      domain,
      phone: input.phone,
      headquarters: input.headquarters,
      industry: input.industry,
      notes: input.notes,
    })
    .returning();
  await logActivity(db, {
    entityType: "account",
    entityId: account.id,
    action: "account.created",
    detail: input.name,
    actor: input.actor,
    ploybookRunId: input.ploybookRunId,
  });
  return { account, created: true as const };
}

/** Find-or-create a project. Dedupes by (name slug + city). */
export async function createProject(
  db: Db,
  input: {
    name: string;
    projectType?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    stage?: string;
    ownerAccountId?: string;
    gcAccountId?: string;
    source?: string;
    sourceUrl?: string;
    actor?: string;
    ploybookRunId?: string;
  }
) {
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.name, input.name), eq(projects.city, input.city ?? "")),
  });
  const match =
    existing ?? (await db.query.projects.findFirst({ where: eq(projects.name, input.name) }));
  if (match) return { project: match, created: false as const };

  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      projectType: input.projectType,
      address: input.address,
      city: input.city,
      state: input.state,
      zip: input.zip,
      stage: input.stage ?? "announced",
      ownerAccountId: input.ownerAccountId,
      gcAccountId: input.gcAccountId,
      source: input.source,
      sourceUrl: input.sourceUrl,
    })
    .returning();
  await logActivity(db, {
    entityType: "project",
    entityId: project.id,
    action: "project.created",
    detail: input.name,
    actor: input.actor,
    ploybookRunId: input.ploybookRunId,
  });
  return { project, created: true as const };
}

/** Find-or-create an opportunity for an (account, project) pair. */
export async function createOpportunity(
  db: Db,
  input: {
    name: string;
    accountId?: string;
    projectId?: string;
    opportunityType?: string;
    tradeScope?: string;
    estimatedValue?: string;
    stage?: string;
    source?: string;
    sourceDetail?: string;
    actor?: string;
    ploybookRunId?: string;
  }
) {
  if (input.accountId && input.projectId) {
    const existing = await db.query.opportunities.findFirst({
      where: and(
        eq(opportunities.accountId, input.accountId),
        eq(opportunities.projectId, input.projectId)
      ),
    });
    if (existing) return { opportunity: existing, created: false as const };
  } else if (input.accountId) {
    // Account-level signals (e.g. "brand X expanding into Texas") recur daily —
    // one open account-level opportunity, not one per sighting (radar PRD §19).
    const { isNull } = await import("drizzle-orm");
    const existing = await db.query.opportunities.findFirst({
      where: and(eq(opportunities.accountId, input.accountId), isNull(opportunities.projectId)),
    });
    if (existing) return { opportunity: existing, created: false as const };
  }
  const [opportunity] = await db
    .insert(opportunities)
    .values({
      name: input.name,
      accountId: input.accountId,
      projectId: input.projectId,
      opportunityType: input.opportunityType,
      tradeScope: input.tradeScope,
      estimatedValue: input.estimatedValue,
      stage: input.stage ?? "discovered",
      source: input.source,
      sourceDetail: input.sourceDetail,
    })
    .returning();
  await logActivity(db, {
    entityType: "opportunity",
    entityId: opportunity.id,
    action: "opportunity.created",
    detail: input.name,
    actor: input.actor,
    ploybookRunId: input.ploybookRunId,
  });
  return { opportunity, created: true as const };
}

/** Find-or-create a property (persistent physical location). Dedupes by (address+city) or name. */
export async function createProperty(
  db: Db,
  input: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    type?: string;
    ownerAccountId?: string;
    propertyManagerAccountId?: string;
  }
) {
  if (input.address && input.city) {
    const existing = await db.query.properties.findFirst({
      where: and(eq(properties.address, input.address), eq(properties.city, input.city)),
    });
    if (existing) return { property: existing, created: false as const };
  } else if (input.name) {
    const existing = await db.query.properties.findFirst({
      where: eq(properties.name, input.name),
    });
    if (existing) return { property: existing, created: false as const };
  }
  const [property] = await db
    .insert(properties)
    .values({
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state ?? "TX",
      zip: input.zip,
      type: input.type,
      ownerAccountId: input.ownerAccountId,
      propertyManagerAccountId: input.propertyManagerAccountId,
    })
    .returning();
  return { property, created: true as const };
}

/** Record a typed relationship edge (§9.10). Idempotent per (from, type, to). */
export async function createRelationship(
  db: Db,
  input: {
    fromEntityType: string;
    fromEntityId: string;
    relationshipType: string;
    toEntityType: string;
    toEntityId: string;
    strength?: number;
    confidence?: number;
    source?: string;
  }
) {
  const existing = await db.query.relationships.findFirst({
    where: and(
      eq(relationships.fromEntityId, input.fromEntityId),
      eq(relationships.relationshipType, input.relationshipType),
      eq(relationships.toEntityId, input.toEntityId)
    ),
  });
  if (existing) return { relationship: existing, created: false as const };
  const [relationship] = await db
    .insert(relationships)
    .values({
      fromEntityType: input.fromEntityType,
      fromEntityId: input.fromEntityId,
      relationshipType: input.relationshipType,
      toEntityType: input.toEntityType,
      toEntityId: input.toEntityId,
      strength: input.strength,
      confidence: input.confidence?.toString(),
      source: input.source,
    })
    .returning();
  return { relationship, created: true as const };
}

/** Store source evidence for a field (§9.15). Never overwrites — evidence accumulates. */
export async function saveEvidence(
  db: Db,
  input: {
    entityType: string;
    entityId: string;
    fieldName: string;
    value: unknown;
    sourceUrl?: string;
    sourceName?: string;
    confidence?: number;
    verificationStatus?: "verified" | "inferred" | "assumed" | "unknown";
  }
) {
  const [row] = await db
    .insert(evidence)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName,
      value: input.value as never,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      confidence: input.confidence?.toString(),
      verificationStatus: input.verificationStatus ?? "unknown",
    })
    .returning();
  return row;
}
