import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";

// Master PRD §9 — shared entity graph. Every Ploybook reads/writes these; no parallel records.

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  accountType: text("account_type").notNull().default("prospect"),
  website: text("website"),
  domain: text("domain"),
  phone: text("phone"),
  headquarters: text("headquarters"),
  serviceArea: text("service_area"),
  employeeRange: text("employee_range"),
  revenueRange: text("revenue_range"),
  industry: text("industry"),
  notes: text("notes"),
  strategicValueScore: integer("strategic_value_score"),
  hscFitScore: integer("hsc_fit_score"),
  relationshipScore: integer("relationship_score"),
  prequalificationStatus: text("prequalification_status"),
  ownerUserId: uuid("owner_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id),
  firstName: text("first_name"),
  lastName: text("last_name"),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  roleType: text("role_type"),
  influenceScore: integer("influence_score"),
  relationshipStrength: integer("relationship_strength"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
  source: text("source"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  ownerAccountId: uuid("owner_account_id").references(() => accounts.id),
  propertyManagerAccountId: uuid("property_manager_account_id").references(() => accounts.id),
  type: text("type"),
  status: text("status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  projectType: text("project_type"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  estimatedProjectValue: numeric("estimated_project_value"),
  squareFootage: numeric("square_footage"),
  stage: text("stage").notNull().default("announced"),
  startDate: timestamp("start_date", { withTimezone: true }),
  completionDate: timestamp("completion_date", { withTimezone: true }),
  ownerAccountId: uuid("owner_account_id").references(() => accounts.id),
  gcAccountId: uuid("gc_account_id").references(() => accounts.id),
  architectAccountId: uuid("architect_account_id").references(() => accounts.id),
  developerAccountId: uuid("developer_account_id").references(() => accounts.id),
  propertyId: uuid("property_id").references(() => properties.id),
  source: text("source"),
  sourceUrl: text("source_url"),
  confidence: numeric("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  accountId: uuid("account_id").references(() => accounts.id),
  projectId: uuid("project_id").references(() => projects.id),
  propertyId: uuid("property_id").references(() => properties.id),
  opportunityType: text("opportunity_type"),
  tradeScope: text("trade_scope"),
  estimatedValue: numeric("estimated_value"),
  estimatedCost: numeric("estimated_cost"),
  estimatedMargin: numeric("estimated_margin"),
  fitScore: integer("fit_score"),
  strategicScore: integer("strategic_score"),
  relationshipScore: integer("relationship_score"),
  urgencyScore: integer("urgency_score"),
  overallScore: integer("overall_score"),
  stage: text("stage").notNull().default("discovered"),
  ownerUserId: uuid("owner_user_id"),
  nextAction: text("next_action"),
  nextActionDueAt: timestamp("next_action_due_at", { withTimezone: true }),
  source: text("source"),
  sourceDetail: text("source_detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  dueAt: timestamp("due_at", { withTimezone: true }),
  internalDueAt: timestamp("internal_due_at", { withTimezone: true }),
  baseBidAmount: numeric("base_bid_amount"),
  alternates: jsonb("alternates"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submittedBy: uuid("submitted_by"),
  status: text("status").notNull().default("invited"),
  winProbability: numeric("win_probability"),
  competitor: text("competitor"),
  lossReason: text("loss_reason"),
  awardAmount: numeric("award_amount"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  version: integer("version").notNull().default(1),
  slug: text("slug").unique(),
  status: text("status").notNull().default("draft"),
  subtotal: numeric("subtotal"),
  tax: numeric("tax"),
  total: numeric("total"),
  grossMarginEstimate: numeric("gross_margin_estimate"),
  publicToken: text("public_token"),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  viewCount: integer("view_count").notNull().default(0),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  depositStatus: text("deposit_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id),
  contactId: uuid("contact_id").references(() => contacts.id),
  projectId: uuid("project_id").references(() => projects.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  type: text("type").notNull(),
  direction: text("direction"),
  subject: text("subject"),
  summary: text("summary"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source"),
  sourceId: text("source_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  bidId: uuid("bid_id").references(() => bids.id),
  accountId: uuid("account_id").references(() => accounts.id),
  filename: text("filename").notNull(),
  documentType: text("document_type").notNull().default("other"),
  storageUrl: text("storage_url"),
  extractedTextUrl: text("extracted_text_url"),
  checksum: text("checksum"),
  source: text("source"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const relationships = pgTable("relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromEntityType: text("from_entity_type").notNull(),
  fromEntityId: uuid("from_entity_id").notNull(),
  relationshipType: text("relationship_type").notNull(),
  toEntityType: text("to_entity_type").notNull(),
  toEntityId: uuid("to_entity_id").notNull(),
  strength: integer("strength"),
  confidence: numeric("confidence"),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Master PRD §9.15 — Source Evidence. Stored separately from generated summaries (§33.8).
export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldName: text("field_name").notNull(),
  value: jsonb("value"),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: numeric("confidence"),
  verificationStatus: text("verification_status").notNull().default("unknown"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// PB07 — private ABM account pages. Served at /p/[token], noindex, draft until approved.
export const abmPages = pgTable("abm_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  opportunityId: uuid("opportunity_id").references(() => opportunities.id),
  slug: text("slug").notNull(),
  publicToken: text("public_token").notNull().unique(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  status: text("status").notNull().default("draft"), // draft | published | archived
  viewCount: integer("view_count").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// §17 — HSC knowledge base entries (company facts, capabilities, proof, messaging rules)
export const knowledgeEntries = pgTable("knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  content: jsonb("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
