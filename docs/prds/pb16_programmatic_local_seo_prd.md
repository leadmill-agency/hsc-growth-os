# PB16 — Programmatic Local SEO

**Product:** HSC Growth OS v1  
**Ploybook:** PB16  
**Owner:** Houston Sign Crafters Growth  
**Primary user:** Rameel / HSC growth team  
**Secondary users:** Sales, estimating, operations  
**Version:** 1.0  
**Date:** September 6, 2026  
**Target:** MVP during September 2026  
**Status:** Build-ready  
**Parent spec:** `hsc_growth_os_v1_prd.md`

---
# 1. Purpose

Systematically create unique, useful local landing pages from real geography × product × customer demand without publishing thin near-duplicate AI pages.

## Problem

HSC can rank for many local commercial-signage intents across Greater Houston, but manually creating every page is slow. Blind programmatic SEO would create low-value duplicate pages and brand risk.

## Goals

- Identify high-value local keyword/page gaps.
- Generate pages only when unique local value can be added.
- Reuse verified HSC projects, permit knowledge, and service capability.
- Publish through a controlled human-review workflow.
- Measure qualified pipeline and revenue per page.

## Non-Goals

- Mass-publish thousands of spun pages.
- Make unsupported local ranking/permitting claims.
- Optimize for traffic without commercial relevance.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When systematically create unique, useful local landing pages from real geography × product × customer demand without publishing thin near-duplicate AI pages., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Scheduled SEO opportunity scan.
- PB18 recommendation.
- Manual geography/product expansion.
- Search Console shows demand gap.

## Required Inputs

- Search Console/query data.
- Existing HSC site/page inventory.
- Target geographies.
- Products/customer types.
- HSC projects/photos.
- Local permit/landlord knowledge where verified.
- Conversion/pipeline data.

## Qualification / Decision Rule

Page opportunity score = demand 20 + commercial value 25 + HSC proof 15 + local uniqueness 15 + competition gap 10 + strategic geography 10 + internal-link fit 5. Require uniqueness score threshold before generation.

---

# 4. State Machine

`OPPORTUNITY_FOUND` → `UNIQUENESS_CHECK` → `BRIEF_READY` → `DRAFT` → `REVIEW` → `APPROVED` → `PUBLISHED` → `MEASURING` → `UPDATE_REQUIRED` → `PRUNED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Generate candidate matrix from Geography × Product × Customer Type, but score candidates before drafting.
2. Check whether equivalent page exists/cannibalizes another page.
3. Collect unique local value: actual HSC projects, city/permit notes, common property types, development context, service coverage, photos, FAQs, pricing/process differences when real.
4. Create brief defining primary intent, secondary queries, CTA, proof, internal links, schema, and uniqueness evidence.
5. Generate page from approved HSC design/content components.
6. Run duplication/claim/SEO QA: title/meta/H1, local relevance, internal links, structured data, image alt, conversion CTA, no unsupported superlatives.
7. Human reviews and publishes.
8. Track impressions, clicks, qualified leads, opportunities, revenue, assisted conversions, and cannibalization.
9. Refresh, consolidate, or prune underperforming/thin pages based on data.

---

# 6. Outputs & Artifacts

- SEO opportunity list
- Page brief
- Local evidence pack
- Page draft
- QA report
- Performance record

Every artifact must store:

- `artifact_type`
- `ploybook_run_id`
- related account/project/opportunity/bid/proposal IDs
- source data/evidence IDs
- generated_at
- generated_by model/action
- human review status
- version
- stale/valid state

---

# 7. Data Model Requirements

This Ploybook uses the shared entities in the master PRD rather than introducing parallel records. At minimum, its run must be able to reference:

- `Account`
- `Contact`
- `Project`
- `Property`
- `Opportunity`
- `Interaction`
- `Document`
- `Relationship`
- `SourceEvidence`
- `PloybookRun` / `PloybookStep`
- `Approval`

Where this Ploybook needs specialized data, store it as a typed child object or JSON schema with explicit versioning. Do not overload free-form notes when the field will be queried or scored later.

### Evidence fields

Material extracted/researched values should support:

```ts
type EvidenceBackedValue<T> = {
  value: T | null;
  status: 'verified' | 'inferred' | 'assumed' | 'unknown';
  confidence: number; // 0..1
  sourceEvidenceIds: string[];
  verifiedAt?: string;
  notes?: string;
}
```

---

# 8. UI / UX Requirements

**Growth → SEO Matrix**: rows geographies, columns products/customer types, status/score per cell. Clicking cell shows demand, existing coverage, proof availability, uniqueness, draft, performance, and `Build / Monitor / Skip`.

### Common UI requirements

- Current state and next action are visible above the fold.
- Every important AI output has an evidence drawer or source link.
- Human-editable generated text must be editable before approval.
- Blocking issues are visually distinct from warnings.
- User can see the full run/activity timeline.
- User can cancel/pause a run without deleting produced data.
- Child Ploybooks show parent/child relationship.

---

# 9. Agent Behavior & Prompt Contract

- No unique local evidence = no page.
- Do not repeat city name unnaturally.
- Do not state permit requirements unless verified/current and appropriately caveated.
- Optimize for qualified commercial leads, not raw clicks.
- Avoid cannibalizing stronger existing pages.

### Required output envelope

```json
{
  "summary": "short human-readable result",
  "facts": [],
  "assumptions": [],
  "unknowns": [],
  "risks": [],
  "recommended_next_action": {
    "action": "...",
    "reason": "...",
    "requires_approval": true
  },
  "writebacks": [],
  "child_ploybook_suggestions": []
}
```

If the model lacks evidence, it must put the item in `unknowns` rather than filling the gap.

---

# 10. Approval Policy

The Ploybook may automatically research, classify, score, create internal records, create tasks, and generate drafts.

Human approval is required before:

- sending any external email/message
- publishing/sharing a customer-facing page that was not already approved
- submitting a bid or legally binding form
- changing pricing/commercial terms
- moving money or changing ad budgets
- marking a high-value opportunity Won/Lost when status is inferred rather than explicit

Approval record must preserve the exact artifact/version approved.

---

# 11. Events & Integrations

## Domain events

- `seo.opportunity_found`
- `seo.brief_created`
- `seo.page_drafted`
- `seo.page_approved`
- `seo.page_published`
- `seo.page_update_recommended`
- `seo.page_pruned`

### Event payload minimum

```ts
{
  eventId: string;
  eventType: string;
  occurredAt: string;
  actor: 'system' | 'user' | 'integration';
  ploybookRunId?: string;
  accountId?: string;
  projectId?: string;
  opportunityId?: string;
  bidId?: string;
  proposalId?: string;
  sourceEvidenceIds?: string[];
  payload: Record<string, unknown>;
}
```

Integrations must be implemented behind adapters so the workflow can run with fixture/manual data before every live connector exists.

---

# 12. Analytics & Success Metrics

- Qualified organic leads/page
- Organic pipeline/page
- Revenue/page
- Impression/click growth
- Indexation rate
- Cannibalization incidents
- Pages refreshed/pruned

For v1, every Ploybook run must store:

- started_at / completed_at
- trigger type
- user/automation initiator
- input entity IDs
- final state
- human approvals requested/approved/rejected
- time spent waiting on human
- child Ploybooks launched
- commercial outcome when eventually known

---

# 13. Edge Cases & Failure Handling

- Neighboring cities share same intent.
- HSC has no project photo in a city.
- Permit rules change.
- Page ranks but attracts residential leads.
- Multiple products belong on one stronger page instead of separate pages.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Candidate cannot enter DRAFT without uniqueness evidence.
- **AC2.** Page uses relevant HSC proof or explicitly omits proof instead of fabricating local work.
- **AC3.** Existing equivalent page triggers consolidate/skip recommendation.
- **AC4.** Published page records query cluster and revenue attribution hooks.
- **AC5.** Permit claim includes evidence/date.
- **AC6.** Low-quality page can be pruned/redirected without losing history.

### Definition of Done for September MVP

- End-to-end happy path works using seeded or live data.
- Run is visible in the Ploybooks UI with state/history.
- Evidence is attached to material AI-derived facts.
- Approval gate works for any external/consequential action.
- Rerun is idempotent.
- Metrics/events are logged.
- At least one realistic HSC fixture passes automated acceptance tests.

---

# 15. Claude Code Implementation Checklist

- [ ] Create SEO PageOpportunity schema/matrix.
- [ ] Implement cannibalization/existing-page check.
- [ ] Implement uniqueness score and evidence requirements.
- [ ] Build page brief/generator using site components.
- [ ] Implement SEO/claim QA.
- [ ] Build performance ingestion and page analytics.
- [ ] Add publish/update/prune state machine.
[ ] Add unit tests for scoring/state transitions.
[ ] Add integration test for end-to-end happy path.
[ ] Add duplicate/rerun test.
[ ] Add approval-blocking test.
[ ] Add error/retry test.
[ ] Add event/analytics assertions.
[ ] Add seed data and demo script.

---

# 16. Suggested File/Module Structure

```text
/src/ploybooks/pb16/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb16/
  workspace.tsx
  approval-card.tsx
  artifacts.tsx
```

The exact paths should adapt to the existing repository conventions. Do not create a parallel architecture if equivalent shared services already exist.

---

# 17. Rollout Plan

### Stage A — Fixture mode
Run against seeded examples with no external writes.

### Stage B — Shadow mode
Run on live HSC data, generate recommendations/drafts, but require human execution for every external action.

### Stage C — Assisted production
Allow safe internal writebacks/tasks automatically; external actions still require approval.

### Stage D — Later autonomy
Only after measured accuracy, add narrowly scoped auto-actions with explicit allowlists. This is outside September v1 unless separately approved.

---

## Product Principles

1. **Shared system of record.** Never create duplicate accounts, projects, contacts, opportunities, properties, bids, proposals, or documents if a normalized record already exists.
2. **Evidence first.** Facts that originate from external research or documents must retain source, retrieval date, confidence, and verification state.
3. **Human approval for consequential actions.** Sending emails, publishing public pages, submitting bids, changing commercial terms, or changing ad spend requires explicit approval in v1.
4. **Actionable output.** The workflow must end with a concrete next action, not a research dump.
5. **Idempotent reruns.** Re-running the Ploybook should update existing records and steps rather than duplicate them.
6. **Write back learnings.** Every completed run updates the underlying account/project/opportunity intelligence so the next run starts smarter.
7. **No hidden assumptions.** The UI must distinguish `verified`, `inferred`, `assumed`, and `unknown` values.

---

# 18. Claude Code Start Prompt

> Implement **PB16 — Programmatic Local SEO** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
