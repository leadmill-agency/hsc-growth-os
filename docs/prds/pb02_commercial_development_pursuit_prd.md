# PB02 — Commercial Development Pursuit

**Product:** HSC Growth OS v1  
**Ploybook:** PB02  
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

Detect a commercial development early, map the development ecosystem, and turn one property into multiple linked HSC opportunities across owner, developer, GC, common-area signage, and tenants.

## Problem

HSC usually encounters commercial developments at the tenant level, after much of the signage/awning opportunity has already been fragmented among vendors. A development-first system can surface common-area scope and then create a stream of tenant opportunities as leases are announced.

## Goals

- Discover developments before or during construction, not only when a tenant requests a quote.
- Build one canonical development graph containing property, owner/developer, architect, GC, property manager, and tenants.
- Estimate total HSC revenue potential without overstating certainty.
- Create account-level and tenant-level pursuits from one development.
- Continuously enrich the development as tenants and construction milestones change.

## Non-Goals

- Predict unannounced tenants by name without evidence.
- Replace commercial real-estate databases.
- Mass-email every tenant or project participant.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When detect a commercial development early, map the development ecosystem, and turn one property into multiple linked HSC opportunities across owner, developer, GC, common-area signage, and tenants., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Permit/planning signal indicates new retail, restaurant, medical, mixed-use, or multi-tenant development.
- Developer/CRE announcement.
- GC project page or public notice.
- Tenant announcement tied to an existing development.
- Manual launch from Property/Project.

## Required Inputs

- Property/address/parcel or development name.
- Developer/owner if known.
- Known GC/architect.
- Announced tenants.
- Development size, use type, construction phase, and opening window if known.
- Source evidence.

## Qualification / Decision Rule

`development_fit_score` 0–100: geography 15, number of tenant/common-area opportunities 20, likely signage/awning intensity 15, project stage 15, strategic developer/GC value 10, estimated total HSC revenue 15, evidence confidence 5, access/relationship 5. Favor Houston growth corridors, retail, restaurant, mixed-use, medical, and projects with at least five plausible HSC scopes.

---

# 4. State Machine

`DETECTED` → `VALIDATING` → `MAPPING` → `SCOPING` → `PURSUE_DEVELOPER` → `PURSUE_GC` → `TENANT_MONITORING` → `ACTIVE_TENANT_PURSUE` → `CONSTRUCTION_ACTIVE` → `STABILIZED` → `ARCHIVED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Normalize the property using address/parcel and create one Development Project record.
2. Resolve owner, developer, architect, GC, leasing broker/property manager, and public project contacts.
3. Create a development relationship graph with evidence-backed edges.
4. Classify likely HSC scope into common-area monument/wayfinding/building ID, GC-procured signage/awning scope, and tenant-specific storefront scope.
5. Estimate total opportunity range using explicit assumptions: common-area scope range + announced tenant count × typical relevant HSC range + unannounced tenant count range. Show assumptions separately.
6. Identify announced tenants and create child Properties/Projects/Opportunities only when a named tenant or verified suite commitment exists.
7. For strategic developers/GCs, launch PB06/PB07 with a development-specific angle.
8. For each announced tenant, check whether it is a franchise/multi-location brand; if yes, offer PB03 escalation.
9. Create monitoring rules for tenant announcements, permits, leasing updates, GC changes, groundbreaking, shell completion, and certificate-of-occupancy milestones.
10. Write won/lost tenant opportunities back to the parent development and update development penetration.

---

# 6. Outputs & Artifacts

- Development brief
- Property/development graph
- Tenant roster with verification state
- HSC scope map
- Revenue potential model
- Developer/GC pursuit recommendations
- Development monitoring feed

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

Primary surface: **Development Workspace** with map/header, phase/timeline, parties, HSC opportunity tree, tenant roster, common-area scope, estimated revenue range, source evidence, and child pursuits. A development should visually show `1 property → N counterparties → N tenant opportunities`.

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

- Never label a rumored tenant as confirmed.
- Keep common-area and tenant scope separate.
- Show ranges and assumptions for revenue potential; no fake precision.
- Prefer early relationship routes to developer/GC over blasting future tenants.
- Deduplicate tenants by brand + suite/address.

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

- `development.detected`
- `development.validated`
- `development.tenant_announced`
- `development.gc_changed`
- `development.stage_changed`
- `development.child_opportunity_created`
- `development.opportunity_won`

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

- Qualified developments/week
- Pipeline created per development
- Common-area opportunities created
- Tenant opportunities created
- Tenant penetration rate
- Revenue per development
- Lead time before tenant opening

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

- Development changes name.
- Developer sells project.
- GC changes midstream.
- Mixed-use project has multiple parcels/addresses.
- Tenant announcement is later canceled.
- Same brand has multiple suites/phases.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** One address produces a canonical development with no duplicate property.
- **AC2.** Confirmed and inferred parties/tenants render differently.
- **AC3.** Revenue estimate shows assumptions and low/base/high range.
- **AC4.** Adding a tenant announcement creates one child opportunity and preserves parent link.
- **AC5.** A known franchise tenant can launch PB03 without creating a duplicate brand account.
- **AC6.** Monitoring update changes project state without overwriting historical evidence.

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

- [ ] Create Development and tenant-roster components.
- [ ] Implement party-resolution and development graph.
- [ ] Implement revenue-range calculator with assumptions.
- [ ] Add child opportunity creation flow.
- [ ] Add monitoring event handlers.
- [ ] Wire PB03/PB06/PB07 escalations.
- [ ] Create sample fixture for a Richmond/Katy-style retail development.
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
/src/ploybooks/pb02/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb02/
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

> Implement **PB02 — Commercial Development Pursuit** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.
