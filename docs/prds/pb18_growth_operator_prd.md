# PB18 — Growth Operator

**Product:** HSC Growth OS v1  
**Ploybook:** PB18  
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

Act as HSC’s weekly AI growth operator by synthesizing revenue, pipeline, bids, proposals, web, SEO, paid acquisition, outreach, and account activity into a ranked set of executable recommendations.

## Problem

HSC has data across many systems but still requires the owner to manually decide what changed and what to do next. Dashboards describe the past; the Growth Operator should turn data into decisions and runnable Ploybooks.

## Goals

- Produce one concise weekly growth brief.
- Identify meaningful changes, not every metric movement.
- Rank actions by expected impact, urgency, confidence, and effort.
- Make each recommendation executable through another Ploybook or explicit task.
- Track whether recommendations were accepted and what happened.

## Non-Goals

- Autonomously control ad budgets or commercial strategy in v1.
- Produce a generic KPI summary with no actions.
- Pretend attribution is certain when data is incomplete.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When act as HSC’s weekly AI growth operator by synthesizing revenue, pipeline, bids, proposals, web, SEO, paid acquisition, outreach, and account activity into a ranked set of executable recommendations., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Weekly Monday run, default 7:00 AM Central.
- Manual run before operating review.
- Optional month-end run.

## Required Inputs

- Booked revenue/cash if available.
- Pipeline/opportunities.
- Bids/submissions/outcomes.
- Proposals/engagement.
- Website and high-intent visitors.
- SEO/content performance.
- Paid ads and lead quality.
- Outreach/Swarm activity.
- Account/project signals.
- Capacity constraints and strategic priorities.

## Qualification / Decision Rule

Recommendation score = expected impact 30 + urgency 20 + confidence 20 + strategic alignment 15 + ease/effort inverse 10 + learning value 5. Maximum 7 primary recommendations per weekly brief.

---

# 4. State Machine

`DATA_COLLECTING` → `QUALITY_CHECK` → `ANALYZING` → `RECOMMENDATIONS_DRAFT` → `REVIEW` → `PUBLISHED` → `ACTIONS_LAUNCHED` → `FOLLOWUP_MEASURED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Collect metric snapshots with source/freshness and flag missing/broken inputs.
2. Compare week-over-week, trailing 4-week, month-to-date, and relevant target/baseline—not just one period.
3. Identify meaningful movements and likely drivers, separating correlation from verified cause.
4. Generate 3–7 observations covering revenue/pipeline, sales/bids, acquisition, and account/opportunity activity.
5. Generate candidate actions and connect each to an executable Ploybook or task.
6. Score/rank recommendations by impact/urgency/confidence/effort.
7. Produce brief with: Revenue, Pipeline, Opportunities, Sales/Bids, Marketing, What Changed, Risks, Recommendations.
8. User approves/rejects/edits each recommendation.
9. Approved recommendations launch child Ploybooks with context.
10. At next run, report prior recommendation outcomes: launched, completed, ignored, result known/unknown.

---

# 6. Outputs & Artifacts

- Weekly Growth Brief
- Metric quality report
- Observation set
- Ranked recommendation list
- Recommendation outcome log

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

**Home → Growth Command Center**. Top KPI strip; `Needs You`; new high-scoring opportunities; running agents; then PB18 brief. Each recommendation card shows rationale, supporting metrics, confidence, expected impact, effort, and `Launch / Edit / Dismiss`. Previous recommendations have outcome status.

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

- Do not overstate causality.
- Broken attribution/tracking is itself a top operational issue when material.
- Prefer a few strong actions over 20 weak ones.
- Recommendation must specify owner/action/why-now and map to Ploybook where possible.
- Always compare to appropriate baseline and mention data gaps.

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

- `growth_operator.run_started`
- `growth_operator.data_gap_found`
- `growth_operator.brief_ready`
- `growth_operator.recommendation_approved`
- `growth_operator.recommendation_dismissed`
- `growth_operator.child_run_started`
- `growth_operator.outcome_measured`

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

- Recommendation approval rate
- Recommendations completed
- Pipeline from recommendations
- Revenue from recommendations
- Median time to action
- Repeat unresolved recommendations
- Data quality issues detected/resolved

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

- Tracking is broken.
- Revenue spike from one large job distorts week.
- Insufficient sample size.
- Same recommendation appears week after week.
- Multiple channels claim same conversion.
- Capacity constraint makes high-demand action undesirable.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Brief explicitly flags missing/stale data.
- **AC2.** No more than seven primary recommendations.
- **AC3.** Every recommendation has evidence/rationale and an executable action.
- **AC4.** Approved recommendation launches correct child Ploybook with context.
- **AC5.** Next brief reports status of prior recommendations.
- **AC6.** One-off revenue spikes are contextualized rather than treated as trend.

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

- [ ] Create metric snapshot/quality layer.
- [ ] Implement comparison windows and anomaly checks.
- [ ] Create observation/recommendation schema + scoring.
- [ ] Build Growth Brief UI.
- [ ] Implement child Ploybook launcher.
- [ ] Implement recommendation outcome tracking.
- [ ] Create fixture with revenue spike, broken tracking, new development signals, and bid activity.
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
/src/ploybooks/pb18/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb18/
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

> Implement **PB18 — Growth Operator** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
