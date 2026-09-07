# PB03 — Franchise Expansion

**Product:** HSC Growth OS v1  
**Ploybook:** PB03  
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

Convert a brand expansion signal into a repeatable multi-location signage rollout pursuit across franchisor, franchisee groups, GCs, developers, and individual store projects.

## Problem

HSC can win individual franchise locations but often does not convert that work into a regional account. Brand openings are scattered across franchisees, developers, GCs, and markets; without a shared brand graph HSC repeatedly starts from zero.

## Goals

- Create a canonical brand account and expansion map.
- Identify the actual buying path rather than assuming the franchisor buys signage.
- Turn each verified opening into a trackable location project.
- Package HSC as a rollout operator, not a one-off sign shop.
- Measure percentage of brand openings captured.

## Non-Goals

- Claim exclusive/approved vendor status without proof.
- Scrape or store protected franchise disclosure information unlawfully.
- Automatically quote stores before sign standards/site conditions are known.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When convert a brand expansion signal into a repeatable multi-location signage rollout pursuit across franchisor, franchisee groups, GCs, developers, and individual store projects., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- New store permit/opening detected.
- Brand announces market expansion.
- Existing HSC brand customer opens another location.
- Developer development roster identifies a multi-location brand.
- Manual brand launch.

## Required Inputs

- Brand name/domain.
- Known locations and target geography.
- Franchisor/franchisee group if known.
- Permit/opening signals.
- Existing HSC job history with the brand.
- Known sign criteria or brand standards.

## Qualification / Decision Rule

`franchise_fit_score`: Texas/Houston expansion velocity 20, average signage package potential 15, location repeatability 20, decision-maker accessibility 10, HSC operational fit 15, existing proof/relationship 10, market adjacency 5, evidence confidence 5.

---

# 4. State Machine

`BRAND_DETECTED` → `FOOTPRINT_MAPPING` → `BUYING_PATH_RESEARCH` → `ROLLOUT_MODEL_READY` → `ACCOUNT_PURSUE` → `LOCATION_MONITORING` → `LOCATION_PURSUE` → `PILOT_WON` → `ROLLOUT_ACTIVE` → `DORMANT`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Normalize/create Brand Account and parent/child franchisee relationships.
2. Build verified existing footprint and Texas pipeline using properties/projects.
3. Research franchisor construction/real-estate roles, major franchisee groups, common GCs/developers, and vendor program signals.
4. Determine probable buying path per market/location: franchisor-controlled, franchisee-controlled, GC-bought, developer-provided, or mixed. Store confidence.
5. Capture sign standards, landlord criteria, typical package components, and any known approved-vendor requirements as documents/evidence.
6. Create a rollout capability model: site survey, landlord/brand approval, permitting, shop drawings, fabrication, shipping/local install, project management, warranty/service.
7. Generate brand-specific rollout page and outreach sequence; use PB06 for strategic accounts.
8. Create each verified opening as a child Project/Property/Opportunity with opening stage and responsible buyer path.
9. Monitor permits, opening announcements, franchisee growth, and repeat HSC jobs.
10. After first win, automatically generate a "convert pilot to rollout" recommendation and business case via PB15 when appropriate.

---

# 6. Outputs & Artifacts

- Brand account research
- Expansion map
- Franchisee/GC relationship graph
- Sign-standard library
- Texas rollout capability page
- Location tracker
- Pilot-to-rollout business case

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

**Brand Workspace**: headline KPIs (known locations, Texas openings, HSC wins, capture rate), map/list of locations, buying-path matrix, franchisee groups, decision makers, standards/docs, rollout offer, active pursuits, and expansion timeline.

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

- Do not assume franchisor controls signage procurement.
- Represent each store as a separate project/property even when rolled up under a brand.
- Separate public opening plans from inferred expansion.
- Prefer converting a successful pilot into a program over broad cold outreach.
- Use brand-safe language; never imply affiliation that does not exist.

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

- `franchise.brand_created`
- `franchise.location_detected`
- `franchise.buying_path_updated`
- `franchise.pilot_won`
- `franchise.rollout_opportunity_created`
- `franchise.location_won`

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

- Verified openings discovered
- Openings pursued
- Locations won
- Revenue per brand
- Capture rate of known openings
- Repeat order rate
- Time from first location win to rollout conversation

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

- Multiple franchisee entities use same brand.
- Corporate and franchised stores coexist.
- One franchisee owns multiple brands.
- Brand standards are outdated or location-specific.
- Opening is canceled or delayed.
- A GC purchases signage on behalf of franchisee.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** System can represent one brand with multiple franchisee groups and multiple buyer paths.
- **AC2.** A new permit can create a location project without duplicating existing location.
- **AC3.** Rollout page only uses verified standards/capabilities.
- **AC4.** Capture rate denominator uses only verified known openings.
- **AC5.** First location win triggers a recommended rollout action.
- **AC6.** Existing HSC brand history is visible on every new location pursuit.

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

- [ ] Create Brand/Franchisee relationship types.
- [ ] Build expansion map/location tracker.
- [ ] Implement buying-path classification + confidence.
- [ ] Add standards/document library view.
- [ ] Wire PB06/PB07/PB15 child runs.
- [ ] Implement capture-rate analytics.
- [ ] Create sample fixture with 10+ Texas locations.
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
/src/ploybooks/pb03/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb03/
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

> Implement **PB03 — Franchise Expansion** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
