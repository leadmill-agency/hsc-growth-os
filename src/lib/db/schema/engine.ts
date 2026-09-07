import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// Master PRD §9.11–§9.14 + §20–21 — Ploybook engine, approvals, events, activity.

export const ploybooks = pgTable("ploybooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0"),
  enabled: boolean("enabled").notNull().default(true),
  triggerTypes: jsonb("trigger_types").$type<string[]>().notNull().default([]),
  defaultConfig: jsonb("default_config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Run statuses: queued | running | waiting_for_approval | paused | completed | failed | cancelled
export const ploybookRuns = pgTable("ploybook_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ploybookId: uuid("ploybook_id")
    .notNull()
    .references(() => ploybooks.id),
  ploybookKey: text("ploybook_key").notNull(),
  triggerType: text("trigger_type").notNull().default("manual"),
  triggerPayload: jsonb("trigger_payload").notNull().default({}),
  primaryEntityType: text("primary_entity_type"),
  primaryEntityId: uuid("primary_entity_id"),
  parentRunId: uuid("parent_run_id"),
  status: text("status").notNull().default("queued"),
  currentStep: text("current_step"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  initiatedBy: text("initiated_by").notNull().default("system"),
  resultSummary: text("result_summary"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Step statuses: pending | running | waiting_for_approval | completed | failed | skipped
export const ploybookSteps = pgTable("ploybook_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => ploybookRuns.id),
  stepKey: text("step_key").notNull(),
  stepOrder: integer("step_order").notNull(),
  status: text("status").notNull().default("pending"),
  inputs: jsonb("inputs").notNull().default({}),
  outputs: jsonb("outputs").notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: text("error"),
});

// Approval statuses: pending | approved | rejected | edited | expired
export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => ploybookRuns.id),
  stepId: uuid("step_id").references(() => ploybookSteps.id),
  approvalType: text("approval_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  proposedAction: text("proposed_action"),
  payload: jsonb("payload").notNull().default({}),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: text("resolved_by"),
  resolutionPayload: jsonb("resolution_payload"),
});

// §20 — domain events. Ploybook triggers subscribe to these.
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actor: text("actor").notNull().default("system"),
  ploybookRunId: uuid("ploybook_run_id"),
  accountId: uuid("account_id"),
  projectId: uuid("project_id"),
  opportunityId: uuid("opportunity_id"),
  bidId: uuid("bid_id"),
  proposalId: uuid("proposal_id"),
  payload: jsonb("payload").notNull().default({}),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// §21 — chronological per-entity activity feed. No black-box automation.
export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  actor: text("actor").notNull().default("system"),
  action: text("action").notNull(),
  detail: text("detail"),
  ploybookRunId: uuid("ploybook_run_id"),
  metadata: jsonb("metadata").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});
