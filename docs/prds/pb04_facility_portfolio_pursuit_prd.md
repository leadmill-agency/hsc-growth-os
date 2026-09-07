# PB04 — Facility Portfolio Pursuit

**Product:** HSC Growth OS v1  
**Ploybook:** PB04  
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

Turn a multi-location operator into a portfolio-level signage, service, remodel, and rollout account rather than a collection of unrelated one-off jobs.

## Problem

Hospitals, banks, gas stations, car washes, restaurant groups, property managers, and other operators own many physical locations, but HSC often sees only one job at a time. The value is in discovering the portfolio, central buyers, recurring service needs, and expansion/remodel signals.

## Goals

- Map the operator’s physical footprint and relevant decision makers.
- Identify central vs local buying authority.
- Create a portfolio-level offer tied to recurring needs.
- Generate location-level opportunities from expansion, remodel, service, or rebrand signals.
- Measure share of portfolio serviced by HSC.

## Non-Goals

- Promise nationwide service coverage HSC cannot deliver.
- Infer maintenance condition from imagery alone without labeling it as a lead signal.
- Replace facility management or work-order systems.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When turn a multi-location operator into a portfolio-level signage, service, remodel, and rollout account rather than a collection of unrelated one-off jobs., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Strategic multi-location operator identified.
- Existing customer is found to own/manage multiple locations.
- New facility, remodel, rebrand, acquisition, or damaged-sign signal.
- Manual launch.

## Required Inputs

- Operator account.
- Known location list.
- Facilities/construction/real-estate/procurement contacts.
- Existing HSC jobs.
- Service area and product capabilities.

## Qualification / Decision Rule

`portfolio_fit_score`: number of addressable locations 20, recurring signage/service intensity 15, geographic concentration 15, centralized procurement potential 10, expansion/remodel velocity 10, estimated annual spend 15, HSC proof/relationship 10, contactability 5.

---

# 4. State Machine

`TARGETED` → `PORTFOLIO_MAPPING` → `BUYER_MAPPING` → `PROGRAM_DESIGN` → `ACCOUNT_PURSUE` → `PILOT` → `PORTFOLIO_ACTIVE` → `EXPANSION_MONITORING` → `DORMANT`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Normalize operator and all verified properties/locations.
2. Classify each location by type, ownership/management relationship, geography, and known signage condition/events.
3. Research organizational buying roles: facilities, construction, real estate, procurement, marketing/brand, regional ops, property management.
4. Determine purchasing model: centralized, regional, site-level, property-owner controlled, or mixed.
5. Identify current/likely vendor model and pain points only where evidence exists.
6. Create portfolio opportunity map: new openings, remodels, rebrands, service/repair, code changes, replacements, common-area programs.
7. Generate a portfolio offer with service boundaries, SLA assumptions, survey/permit/install process, reporting, and program management.
8. Use PB06 to multi-thread central and regional buyers and PB07 for a private portfolio page.
9. Create location-level opportunities as verified signals appear.
10. Track locations serviced, repeat revenue, and portfolio penetration over time.

---

# 6. Outputs & Artifacts

- Portfolio map
- Location dataset
- Buying-authority map
- Portfolio opportunity list
- Centralized signage program page
- Account outreach bundle
- Portfolio penetration dashboard

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

**Portfolio Workspace** should combine a map and table of locations, filters by status/opportunity type, central contacts, purchasing model, HSC jobs, upcoming signals, service coverage, annual revenue, and penetration percentage.

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

- Do not treat every location as independently buyable if landlord or corporate controls signage.
- Be explicit about HSC geographic coverage.
- Use current HSC service data to rank near-term opportunities.
- Distinguish one-time capex projects from recurring service work.
- Keep central account narrative separate from location-specific scopes.

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

- `portfolio.created`
- `portfolio.location_added`
- `portfolio.signal_detected`
- `portfolio.pilot_won`
- `portfolio.location_opportunity_created`
- `portfolio.program_active`

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

- Addressable locations
- Locations with active opportunity
- Locations serviced
- Portfolio penetration
- Annual revenue/account
- Repeat revenue rate
- Average revenue/location

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

- Operator leases locations and landlord controls exterior signage.
- Properties are managed by third-party FM company.
- Portfolio spans states outside HSC coverage.
- Brand uses regional franchisees.
- Same physical property contains multiple operator brands.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** System can ingest 50+ locations without duplicate properties.
- **AC2.** Central and local purchasing roles can coexist.
- **AC3.** Portfolio page clearly states service geography and does not overclaim.
- **AC4.** Location signal creates a child opportunity linked to parent account.
- **AC5.** Dashboard computes penetration from addressable verified locations.
- **AC6.** Existing HSC jobs are visible as proof and relationship context.

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

- [ ] Create portfolio location import/dedupe.
- [ ] Add purchasing-model classification.
- [ ] Build portfolio map/table + filters.
- [ ] Implement location signal/opportunity generation.
- [ ] Wire PB06/PB07.
- [ ] Add penetration/repeat-revenue analytics.
- [ ] Create healthcare or multi-site operator fixture.
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
/src/ploybooks/pb04/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb04/
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

> Implement **PB04 — Facility Portfolio Pursuit** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
