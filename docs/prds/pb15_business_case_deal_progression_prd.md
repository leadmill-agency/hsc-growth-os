# PB15 — Business Case / Deal Progression

**Product:** HSC Growth OS v1  
**Ploybook:** PB15  
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

Create a source-backed internal business case that helps a buyer justify a large HSC rollout, portfolio program, or strategic project to other stakeholders.

## Problem

Large deals often stall not because HSC lacks a quote but because the champion cannot explain the operational/financial case internally. A generic proposal does not address current-state pain, vendor fragmentation, implementation, assumptions, or risk.

## Goals

- Turn discovery information into a decision document.
- Separate confirmed facts from estimates/assumptions.
- Show current state vs proposed HSC operating model.
- Provide low/base/high financial or operational scenarios when useful.
- Identify the next missing information required to progress the deal.

## Non-Goals

- Invent ROI numbers.
- Use this for small transactional signage jobs.
- Promise savings HSC cannot substantiate.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When create a source-backed internal business case that helps a buyer justify a large HSC rollout, portfolio program, or strategic project to other stakeholders., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Strategic deal exceeds value/complexity threshold.
- Franchise rollout after pilot.
- Facility portfolio opportunity.
- Large multi-site/awning program.
- Deal marked stalled due to internal justification.

## Required Inputs

- Discovery notes/interactions.
- Current vendor/process facts.
- Locations/projects.
- Known costs, delays, defect/service history if supplied.
- HSC proposed scope/pricing.
- Implementation assumptions.

## Qualification / Decision Rule

Recommended when deal is multi-location, multi-stakeholder, > configured value threshold, or buyer explicitly needs internal approval. Not for a normal $5k storefront sign.

---

# 4. State Machine

`DATA_GATHERING` → `FACT_ASSUMPTION_SPLIT` → `MODEL_DRAFT` → `INTERNAL_REVIEW` → `CUSTOMER_READY` → `SHARED` → `UPDATED` → `DECISION`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Collect confirmed requirements and source every material fact to notes/documents/customer-provided data.
2. Create separate tables for Confirmed Facts, HSC Estimates, Customer Assumptions, Unknowns.
3. Model current state: vendor count, handoffs, locations, time, cost categories, inconsistency/risk where supported.
4. Model proposed HSC state: process, ownership, standardization, service levels, rollout sequence.
5. Create quantitative low/base/high ranges only for variables with reasonable inputs; otherwise use qualitative impact.
6. List risks and mitigations on both current and proposed models.
7. Create implementation plan/pilot path and decision needed.
8. Generate “What we still need to know” section to drive next discovery call.
9. Human validates commercial/financial claims before sharing.
10. Update model as new information arrives without losing prior version.

---

# 6. Outputs & Artifacts

- Business case document/page
- Fact/assumption register
- Scenario model
- Implementation plan
- Decision checklist

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

**Opportunity Workspace → Business Case** with editable fact/assumption table, model variables, scenarios, evidence, narrative preview, and customer-ready output. Unknowns should be prominent and convertible into follow-up questions/tasks.

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

- Never convert assumption to fact because it is repeated.
- Use ranges rather than false precision.
- If savings cannot be quantified, state operational benefit qualitatively.
- Every material commercial claim needs owner review.
- The objective is decision progression, not a flashy ROI number.

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

- `business_case.started`
- `business_case.unknown_identified`
- `business_case.review_requested`
- `business_case.shared`
- `business_case.updated`
- `business_case.decision_recorded`

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

- Strategic deals with business case
- Deal progression after share
- Enterprise close rate
- Days stalled before/after
- Unknowns resolved
- Pilot → rollout conversion

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

- Customer will not share current costs.
- Benefits are mostly risk/consistency rather than savings.
- Multiple scenarios/locations have different economics.
- Champion changes.
- Price changes mid-process.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Output visibly separates facts, assumptions, estimates, and unknowns.
- **AC2.** Scenario calculations trace to explicit variables.
- **AC3.** Missing cost inputs do not produce fake ROI.
- **AC4.** Version updates preserve previous customer-shared model.
- **AC5.** Unknown can become a task/question.
- **AC6.** Commercial claims require human approval before sharing.

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

- [ ] Create fact/assumption/unknown schema.
- [ ] Build scenario model component.
- [ ] Build current-state vs HSC-state template.
- [ ] Implement evidence links and versioning.
- [ ] Build customer-ready export/page.
- [ ] Wire PB03/PB04/PB14.
- [ ] Add multi-location test case.
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
/src/ploybooks/pb15/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb15/
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

> Implement **PB15 — Business Case / Deal Progression** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
