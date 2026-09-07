# PB05 — Opportunity Radar

**Product:** HSC Growth OS v1  
**Ploybook:** PB05  
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

Continuously ingest external and internal signals, deduplicate them, score HSC relevance, and present a ranked daily inbox of opportunities with a recommended Ploybook.

## Problem

HSC cannot manually monitor every permit, bid notice, development announcement, franchise opening, email invite, website visit, and account signal. Raw feeds are noisy; the product value is resolving those signals into a small number of high-confidence actions.

## Goals

- Create one ranked daily opportunity inbox.
- Deduplicate repeated signals about the same company/project/property.
- Explain why each opportunity matters and what evidence supports it.
- Recommend the correct downstream Ploybook.
- Learn from Pursue/Monitor/Ignore decisions.

## Non-Goals

- Be a general news reader.
- Create opportunities from weak/unverifiable signals just to increase volume.
- Automatically pursue everything above a threshold.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When continuously ingest external and internal signals, deduplicate them, score HSC relevance, and present a ranked daily inbox of opportunities with a recommended Ploybook., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Scheduled daily run, default 6:00 AM Central.
- Manual refresh by user.
- Webhook/event from connected email, CRM, permit, visitor, or bid source.

## Required Inputs

- Raw signals from web/bid notices/permits/construction databases/news/email/CRM/website activity.
- HSC geography, products, account strategy, current capacity.
- Historical pursued/ignored/won/lost data.

## Qualification / Decision Rule

Each signal receives `signal_confidence` and resolved opportunity receives `opportunity_fit_score`. Ranking uses fit × confidence × urgency × novelty. Duplicate signals increase evidence confidence but do not create duplicate cards.

---

# 4. State Machine

`INGESTED` → `RESOLVING` → `DEDUPED` → `CLASSIFIED` → `SCORED` → `SUGGESTED` → `PURSUE` → `MONITOR` → `IGNORE` → `EXPIRED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Ingest signals with source, timestamp, source type, raw text/metadata, and link/document reference.
2. Extract candidate entities: company, project, property/address, contact, trade, deadline, opening date, geography.
3. Resolve against existing HSC entities and calculate dedupe similarity; merge only above safe threshold or request review.
4. Classify opportunity type: GC project, development, franchise, facility portfolio, bid invite, website intent, SEO/content, or other.
5. Determine HSC scope relevance and reject obvious non-fit items.
6. Calculate confidence, fit, urgency, strategic value, and time sensitivity.
7. Generate a two-sentence `why_this_matters` grounded in evidence and one recommended next Ploybook.
8. Rank cards and suppress low-value repetitive noise.
9. User chooses Pursue, Monitor, Ignore; store reason/feedback.
10. On Pursue, launch recommended Ploybook with resolved entities and evidence attached.
11. On Monitor, create watch conditions; on Ignore, create suppression rule scoped to signal/account/category where appropriate.

---

# 6. Outputs & Artifacts

- Daily Opportunity Inbox
- Signal evidence bundle
- Resolved entity links
- Why-this-matters explanation
- Recommended Ploybook action

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

**Opportunity Inbox**: ranked cards with score, urgency badge, opportunity type, company/project, location, source count, why-it-matters, evidence preview, and `Pursue / Monitor / Ignore`. Filters: type, score, geography, source, due date, product, strategic account.

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

- More data is not better; optimize for useful opportunities surfaced.
- Never hide an imminent bid deadline behind lower-urgency strategic items.
- Merged signals must remain individually inspectable.
- An unsupported inference cannot be the sole reason for a high score.
- Ignored feedback should tune ranking but not permanently suppress an account unless user explicitly chooses that.

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

- `radar.run_started`
- `signal.ingested`
- `signal.merged`
- `opportunity.suggested`
- `opportunity.pursued`
- `opportunity.monitored`
- `opportunity.ignored`

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

- Signals ingested
- Suggested opportunities/day
- Pursue rate
- False-positive/ignore rate
- Pursued → bid/quote rate
- Pursued → revenue rate
- Median signal-to-suggestion latency
- Duplicate suppression rate

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

- Same bid notice reposted on multiple sites.
- Address formatting differs.
- Project has no name.
- Signal refers to an account HSC already has an active opportunity with.
- Deadline is in the past.
- Source is inaccessible after initial ingestion.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Five duplicate signals about one project create one opportunity card with five evidence sources.
- **AC2.** Past-due bid is clearly labeled and does not show as normal active deadline.
- **AC3.** Every suggested card explains fit and has a recommended downstream Ploybook.
- **AC4.** Pursue passes resolved account/project/evidence to downstream run.
- **AC5.** Ignore stores reason and does not delete source evidence.
- **AC6.** Inbox can be filtered to score ≥75 and due within 14 days.

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

- [ ] Create RawSignal schema and ingestion adapter interface.
- [ ] Implement entity extraction/resolution/dedupe service.
- [ ] Implement ranking/scoring pipeline.
- [ ] Build Opportunity Inbox UI.
- [ ] Implement Pursue/Monitor/Ignore feedback actions.
- [ ] Add downstream Ploybook launch router.
- [ ] Create fixtures for duplicate bid notice, development, franchise, and website intent.
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
/src/ploybooks/pb05/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb05/
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

> Implement **PB05 — Opportunity Radar** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
