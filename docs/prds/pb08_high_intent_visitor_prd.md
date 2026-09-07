# PB08 — High-Intent Visitor

**Product:** HSC Growth OS v1  
**Ploybook:** PB08  
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

Turn identifiable, high-value website activity into a relevant account action while filtering out low-intent noise and avoiding creepy outreach.

## Problem

Website traffic is usually treated as aggregate analytics. Some company-level visits are strong buying signals, especially to product, pricing, portfolio, proposal, or multi-location pages, but HSC needs rules to separate useful intent from random traffic.

## Goals

- Resolve company-level intent where technically and legally available.
- Score intent using behavior and account fit.
- Connect visits to existing account/opportunity context.
- Recommend outreach or follow-up only when behavior is meaningful.
- Avoid exposing surveillance-like details in messaging.

## Non-Goals

- Identify private individuals from anonymous browsing.
- Send automated emails because someone visited one page.
- Treat blog traffic as sales intent by default.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When turn identifiable, high-value website activity into a relevant account action while filtering out low-intent noise and avoiding creepy outreach., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Company identification provider reports a visit.
- Known recipient engages with PB07/PB14 page.
- Repeat company visits cross threshold.
- Manual review of website intent feed.

## Required Inputs

- Resolved company/domain if available.
- Page views, timestamps, sessions, referrer, CTA events.
- Existing CRM/account/opportunity state.
- Account strategic score.

## Qualification / Decision Rule

`intent_score` 0–100 combines page intent (35), recency/frequency (20), account fit (25), repeat/multi-person behavior (10), and existing opportunity context (10). High intent ≥75, review 55–74, ignore below 55 unless tied to an active proposal.

---

# 4. State Machine

`VISIT_DETECTED` → `COMPANY_RESOLVED` → `INTENT_SCORED` → `ACCOUNT_MATCHED` → `ACTION_RECOMMENDED` → `APPROVED` → `CONTACTED` → `SUPPRESSED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Ingest visit events and resolve company/domain where supported.
2. Match to existing Account; never create a new strategic account from one weak visit without validation.
3. Classify viewed pages into high/medium/low intent taxonomy.
4. Calculate intent score and explain contributing behaviors.
5. Check current relationship: customer, active opportunity, closed/lost, unknown, competitor/vendor.
6. If active proposal/deal room, recommend context-specific follow-up rather than cold outreach.
7. If unknown but high-fit strategic account, run PB09 account research and identify likely buyer.
8. Create outreach draft that references the business context, not “we saw you on our site.”
9. Offer PB06 Company Swarm only for strategic accounts with strong intent.
10. Apply cooldown/suppression after contact or low-confidence resolution.

---

# 6. Outputs & Artifacts

- Intent event
- Intent score explanation
- Account match
- Recommended action
- Outreach draft

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

**Intent Feed** with company, score, last visit, high-intent pages, existing relationship, opportunity links, and recommended action. Account Workspace embeds visit history. Proposal pages should show recipient/deal-room engagement separately from anonymous company intent.

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

- Never mention specific anonymous browsing behavior in cold outreach.
- One visit is rarely enough.
- Proposal/deal-room engagement has different semantics from public-site browsing.
- Respect suppression/cooldown and existing salesperson ownership.
- Do not create person-level identity without explicit known authentication/email association.

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

- `intent.visit_ingested`
- `intent.company_resolved`
- `intent.high_intent_detected`
- `intent.action_recommended`
- `intent.outreach_approved`
- `intent.suppressed`

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

- High-intent accounts/week
- Intent → conversation
- Intent → quote
- Intent-assisted wins
- False-positive rate
- Median response time to active proposal engagement

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

- ISP/provider misidentifies company.
- Employee visits from personal network.
- Competitor repeatedly visits.
- Customer visits support content.
- Multiple active opportunities exist for one company.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Low-intent blog-only session does not create outreach recommendation.
- **AC2.** Repeat visits to pricing/multi-location pages by high-fit company cross threshold.
- **AC3.** Existing proposal visit routes to opportunity owner and PB14 context.
- **AC4.** Draft outreach does not say “we saw you visit.”
- **AC5.** Company resolution confidence is visible.
- **AC6.** Cooldown prevents repeated recommendations after recent outreach.

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

- [ ] Create page intent taxonomy.
- [ ] Implement intent scoring.
- [ ] Build company-resolution adapter interface.
- [ ] Implement account matching/cooldown.
- [ ] Build Intent Feed UI.
- [ ] Wire PB09/PB06/PB14 routing.
- [ ] Create fixtures for low-, medium-, and high-intent cases.
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
/src/ploybooks/pb08/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb08/
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

> Implement **PB08 — High-Intent Visitor** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
