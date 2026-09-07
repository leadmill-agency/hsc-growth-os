# HSC Growth OS — PB01–PB18 Standalone PRDs

# PB01 — GC Pursuit

**Product:** HSC Growth OS v1  
**Ploybook:** PB01  
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

Turn a discovered general contractor/project into a qualified signage or awning pursuit and create a durable GC relationship that compounds across future projects.

## Problem

HSC currently treats many GC opportunities as one-off bids. Discovery, prequalification, contact research, outreach, project research, and follow-up happen manually and often restart from zero on the next project. The result is missed bid opportunities, weak multi-threading, incomplete vendor readiness, and poor account memory.

## Goals

- Create a qualified GC/project opportunity in under 10 minutes after a credible signal appears.
- Determine whether HSC can actually bid the GC before spending estimator time.
- Map the project stakeholders and the correct path into the opportunity.
- Produce ready-to-review outreach and account collateral.
- Carry the relationship forward across future GC projects.

## Non-Goals

- Automatically submit bids.
- Replace Procore, BuildingConnected, or a GC prequalification platform.
- Send cold outreach without review.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When turn a discovered general contractor/project into a qualified signage or awning pursuit and create a durable GC relationship that compounds across future projects., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Relevant GC project discovered by PB05 Opportunity Radar.
- Public bid notice explicitly includes signage, awnings, architectural metals, wayfinding, or closely related scope.
- Manual launch from an Account, Project, or Opportunity record.
- Existing GC account receives a new project signal.
- High-intent GC website activity is escalated from PB08.

## Required Inputs

- GC account or raw GC name/domain.
- Project name/location if known.
- Trade/scope signal.
- Bid deadline and bid portal if known.
- Source evidence for the originating signal.
- Existing HSC relationship, bid, and revenue history.

## Qualification / Decision Rule

Calculate `gc_pursuit_fit_score` from 0–100 using geography (15), trade fit (20), project value/scope potential (15), GC strategic value (15), existing relationship (10), timing (10), capacity (5), qualification readiness (5), and future account value (5). Scores ≥75 default to `PURSUE`; 55–74 to `REVIEW`; <55 to `MONITOR/PASS`. User can override with a reason.

---

# 4. State Machine

`DISCOVERED` → `QUALIFYING` → `RESEARCHING` → `READINESS_CHECK` → `CONTACT_MAPPING` → `READY_FOR_OUTREACH` → `OUTREACH_ACTIVE` → `BID_ACCESS_REQUESTED` → `BID_RECEIVED` → `BIDDING` → `SUBMITTED` → `WON` → `LOST` → `MONITORING` → `ARCHIVED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Normalize/create the GC Account, Project, Property, and Opportunity records; deduplicate by domain, address, project owner, and project name.
2. Run PB09 Account Research Brief and project research in parallel.
3. Identify owner, developer, architect, GC office, project sector, project value, schedule, procurement stage, known bid platform, and public bid contacts.
4. Research GC vendor/prequalification requirements. Create readiness checklist for W-9, COI, EMR, OSHA, bonding, references, trade codes, financials, certifications, safety requirements, and portal enrollment.
5. Compute fit score and explain top three positive and negative factors.
6. Discover project-specific estimating/preconstruction contacts first; account-level estimating, procurement, PM, and executive contacts second.
7. Create a stakeholder map with role, company, project relationship, influence score, contactability, evidence source, and recommended message angle.
8. Generate the shortest viable bid-access/outreach email and one alternate message for a relationship-building path.
9. Launch PB07 ABM Account Page in draft mode when the GC is strategic or the opportunity is high-value.
10. Create approval bundle containing: research brief, readiness gaps, contact target, email draft, page draft, and recommended next action.
11. After approval, log sent action and monitor for replies. Never send automatically in v1.
12. If bid documents arrive, create/update bid record and emit `bid.invite_received` to PB10.
13. After submission, emit `bid.submitted` to PB13.
14. On win/loss, update GC relationship strength, project outcome, trade history, reasons, and future monitoring rules.

---

# 6. Outputs & Artifacts

- GC research brief
- Project brief
- Vendor readiness checklist
- Stakeholder map
- Outreach approval bundle
- Private GC capability page
- Pursuit activity timeline

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

Primary surface: **Opportunity Workspace → Pursuit tab**. Show fit score, why-now signal, account/project summary, readiness blockers, stakeholder graph, current state, next action, evidence drawer, and approval card. Account Workspace should aggregate all GC projects, bids, revenue, contacts, and win/loss history.

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

- Prefer project-specific bid contacts over senior executives.
- Do not infer that HSC is prequalified unless evidence exists.
- Do not claim scope details that are not in a bid notice or package.
- For cold outreach, default to ≤120 words and one CTA.
- Treat the GC as a long-lived account even if the current project is lost.

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

- `opportunity.gc_pursuit_created`
- `gc.readiness_blocker_found`
- `outreach.approval_requested`
- `outreach.sent`
- `bid.invite_received`
- `bid.submitted`
- `bid.won`
- `bid.lost`

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

- Qualified GC pursuits/week
- Pursuit → bid invite rate
- Bid invites from previously unknown GCs
- GC bid win rate
- Revenue per GC account
- Average number of active relationships per strategic GC
- Time from signal to first approved action

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

- Same project appears under multiple bid notices or aliases.
- GC listed as CM/GC but another entity manages procurement.
- Public deadline already passed.
- HSC fails mandatory prequalification.
- Project-specific contact is a shared mailbox rather than a person.
- No reliable project value is available.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** A raw Harvey Cleary + project signal produces one deduplicated account/project/opportunity.
- **AC2.** System surfaces qualification requirements and marks unknowns instead of assuming readiness.
- **AC3.** At least three relevant stakeholder roles are sought; missing roles are explicitly shown.
- **AC4.** Email draft is project-specific, short, and does not contain invented facts.
- **AC5.** A high-value pursuit can create a PB07 draft without duplicating the account.
- **AC6.** Receiving a bid invite transitions to PB10 with project/account links intact.

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

- [ ] Create GC Pursuit workflow definition and state machine.
- [ ] Implement GC fit score service and override logging.
- [ ] Implement vendor-readiness schema + UI component.
- [ ] Implement stakeholder map object + contact ranking.
- [ ] Implement approval bundle generation.
- [ ] Wire PB09 and PB07 child-run orchestration.
- [ ] Add event hooks for PB10 and PB13.
- [ ] Add fixture using Harvey Cleary/UH-like sample data.
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
/src/ploybooks/pb01/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb01/
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

> Implement **PB01 — GC Pursuit** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

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


---

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


---

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


---

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


---

# PB06 — Company Swarm

**Product:** HSC Growth OS v1  
**Ploybook:** PB06  
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

Create a coordinated multi-contact pursuit for one strategic account, giving each stakeholder a role-specific reason to engage and staggering touches so HSC looks deliberate rather than spammy.

## Problem

HSC often relies on a single contact at an account. Large GCs, developers, franchise groups, and facility operators are multi-threaded buying systems; contacting one person creates fragility, while blasting identical emails to five people looks careless.

## Goals

- Identify the minimum useful set of stakeholders for the active opportunity.
- Rank contacts by influence and relevance.
- Create differentiated hooks and assets per person.
- Schedule coordinated outreach without collisions.
- Update the strategy based on replies and relationship changes.

## Non-Goals

- Mass-email every employee.
- Automate LinkedIn actions that violate platform rules.
- Send outreach without approval.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When create a coordinated multi-contact pursuit for one strategic account, giving each stakeholder a role-specific reason to engage and staggering touches so HSC looks deliberate rather than spammy., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Strategic account flagged by PB01/PB03/PB04.
- High-value opportunity with one or zero active relationships.
- Manual launch on Account/Opportunity.

## Required Inputs

- Account/project/opportunity.
- Known contacts and past interactions.
- Research brief.
- Available HSC proof/assets/pages.

## Qualification / Decision Rule

Swarm is recommended when account strategic score ≥70 or opportunity value exceeds configured threshold and stakeholder complexity is >1. Avoid Swarm for small transactional leads.

---

# 4. State Machine

`PERSONA_PLANNING` → `CONTACT_DISCOVERY` → `HOOK_MAPPING` → `SEQUENCE_DRAFT` → `AWAITING_APPROVAL` → `ACTIVE` → `PAUSED` → `RESPONDED` → `COMPLETED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Determine required personas from opportunity type: estimator/precon/PM/procurement for GC; construction/real estate/franchisee for brand; facilities/procurement/ops for portfolio.
2. Resolve known contacts and discover missing contacts with source evidence.
3. Calculate contact influence score using role relevance, project linkage, seniority, relationship history, and contactability.
4. Assign one primary goal and one hook per contact. Avoid repeating the same value proposition unless necessary.
5. Choose supporting asset per person: bid capability page, case study, qualification packet, rollout page, portfolio page, or none.
6. Draft a staggered sequence with timing rules and stop conditions.
7. Run collision check against recent HSC outreach to the same account/contact.
8. Present a single approval screen showing the whole swarm so user sees how messages interact.
9. After sends, log replies/opens where available and automatically pause related touches if someone engages.
10. Rerank active contacts and recommend next relationship action.

---

# 6. Outputs & Artifacts

- Persona plan
- Contact ranking
- Hook matrix
- Staggered outreach sequence
- Approval bundle
- Relationship heatmap

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

**Account Workspace → Swarm tab**: contact cards arranged by persona/influence, current relationship, message hook, scheduled touch, asset, and status. Timeline should show cross-contact collisions. Approval screen allows approve all, edit individually, remove contact, or change timing.

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

- No identical copy to multiple people.
- Default to 3–5 contacts, not 15.
- Prefer project-relevant mid-level operators over random executives.
- Stop or pause touches when a human reply makes the sequence obsolete.
- Do not reference private information or creepy visitor-level details in outreach.

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

- `swarm.created`
- `swarm.contact_added`
- `swarm.approval_requested`
- `swarm.touch_approved`
- `swarm.touch_sent`
- `swarm.reply_detected`
- `swarm.paused`
- `swarm.completed`

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

- Contacts/account
- Conversation rate/account
- Meetings/account
- Multi-threaded relationship rate
- Reply rate by persona
- Touches avoided due to collision/stop rules

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

- One person holds multiple relevant roles.
- Contact changes companies.
- Two HSC users contact same account separately.
- Shared mailbox is only available contact.
- A reply comes from a different stakeholder than targeted.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** System generates role-distinct messages for at least three personas when evidence supports them.
- **AC2.** No contact with outreach in prior 48 hours is scheduled without warning.
- **AC3.** One reply pauses future touches that would be awkward/redundant.
- **AC4.** User can approve/edit entire sequence from one screen.
- **AC5.** All interactions write back to shared contact/account timeline.
- **AC6.** Contact source and confidence are visible.

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

- [ ] Implement persona templates by account type.
- [ ] Implement contact influence scoring.
- [ ] Build hook/asset matrix.
- [ ] Add sequence scheduler + collision detector + stop rules.
- [ ] Build Swarm approval UI.
- [ ] Integrate interaction logging.
- [ ] Create GC and facility test fixtures.
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
/src/ploybooks/pb06/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb06/
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

> Implement **PB06 — Company Swarm** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB07 — ABM Account Page

**Product:** HSC Growth OS v1  
**Ploybook:** PB07  
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

Generate a private, account-specific HSC web page that packages only the capabilities, proof, documents, and project context relevant to one buyer and one next action.

## Problem

Generic HSC pages and PDFs force prospects to translate HSC’s capabilities into their own use case. Strategic pursuits need tailored collateral, but manual page creation is too slow and overly personalized AI pages can look fake.

## Goals

- Create a useful private page in minutes from existing account/project context.
- Show relevant proof instead of generic portfolio content.
- Provide one clear CTA.
- Track account-level engagement without exposing sensitive data.
- Reuse HSC design system and approved messaging.

## Non-Goals

- Create public SEO pages.
- Invent logos, brand affiliations, project relationships, or testimonials.
- Build arbitrary new website components for every page.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When generate a private, account-specific HSC web page that packages only the capabilities, proof, documents, and project context relevant to one buyer and one next action., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- PB01/PB03/PB04/PB06 requests a page.
- Manual launch from Account/Opportunity.
- Large proposal needs a qualification-style microsite rather than PB14 deal room.

## Required Inputs

- Account/project/opportunity.
- HSC capabilities and service geography.
- Approved case studies/images.
- Qualification documents.
- CTA target.
- Page privacy level.

## Qualification / Decision Rule

Generate when account strategic score ≥60, opportunity is strategically important, or a user explicitly requests it. Skip for low-value commodity leads unless page is templated and nearly free.

---

# 4. State Machine

`DRAFT_REQUESTED` → `CONTENT_SELECTED` → `PAGE_GENERATED` → `REVIEW` → `APPROVED` → `SHARED` → `STALE` → `ARCHIVED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Choose page template based on account type: GC qualification, franchise rollout, facility portfolio, developer, or generic strategic account.
2. Pull verified account/project facts and relevant HSC knowledge-base claims.
3. Rank HSC proof assets by sector/product/geography similarity and select only strongest few.
4. Generate headline, short account-specific context, capabilities, proof, process, qualification docs, and single CTA.
5. Run claim validator: no unsupported affiliation, project claim, certification, turnaround, or pricing statement.
6. Generate page at private/noindex URL with tokenized slug and access control option.
7. Present visual/content review and evidence annotations in admin.
8. After approval, share via approved outreach/proposal flow.
9. Track page visits, unique visitors, return visits, CTA clicks, downloads, and sections viewed where technically reliable.
10. Mark page stale when underlying project closes or key facts/documents expire.

---

# 6. Outputs & Artifacts

- Private account page
- Asset selection manifest
- Claim/evidence report
- Engagement events

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

**Page Builder Admin**: live preview left, structured content/claims/evidence right, selected assets, privacy controls, CTA, publish/share approval. Account Workspace shows page engagement timeline and current page status.

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

- No flattery.
- Do not say “for [Account]” if the content does not actually differ meaningfully.
- Use account logo only when usage is acceptable and source is verified; default to text if uncertain.
- Private/noindex by default.
- One CTA only.

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

- `abm_page.generated`
- `abm_page.approval_requested`
- `abm_page.approved`
- `abm_page.viewed`
- `abm_page.cta_clicked`
- `abm_page.stale`

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

- Time to page draft
- Pages shared
- Unique account visitors
- CTA rate
- Page → reply/bid/meeting rate
- Page-assisted revenue

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

- No relevant HSC case study.
- Account name has trademark concerns.
- Multiple opportunities need different pages for same account.
- Qualification doc expires.
- Page forwarded beyond intended recipient.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Page generated from one account/opportunity uses only approved HSC claims/assets.
- **AC2.** Noindex/private headers are present by default.
- **AC3.** A claim with no evidence is blocked or labeled for review.
- **AC4.** CTA event attaches to account/opportunity.
- **AC5.** A stale COI/document triggers admin warning.
- **AC6.** Two projects for same account can have distinct pages without duplicating account.

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

- [ ] Create account-page templates.
- [ ] Implement asset relevance ranking.
- [ ] Implement claim/evidence validator.
- [ ] Build private page route + noindex/access options.
- [ ] Add page engagement event tracking.
- [ ] Build admin preview/review screen.
- [ ] Wire account timeline.
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
/src/ploybooks/pb07/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb07/
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

> Implement **PB07 — ABM Account Page** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

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


---

# PB09 — Account Research Brief

**Product:** HSC Growth OS v1  
**Ploybook:** PB09  
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

Produce a reusable, structured account intelligence object that every other Ploybook can trust instead of repeating ad hoc web research.

## Problem

Account research currently returns prose that is hard to reuse, goes stale, and may mix facts with inference. Multiple workflows can research the same company independently, causing duplication and contradictions.

## Goals

- Create one canonical research object per account.
- Store structured fields plus evidence, confidence, and freshness.
- Answer the recurring HSC questions: who are they, where are they, what do they build/operate, who matters, what signals exist, and what motion should HSC use?
- Make incremental refreshes cheap.

## Non-Goals

- Produce exhaustive company intelligence unrelated to HSC.
- Store personal/sensitive data not needed for business pursuit.
- Overwrite verified internal relationship history with public research.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When produce a reusable, structured account intelligence object that every other Ploybook can trust instead of repeating ad hoc web research., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Any Ploybook requests account research.
- Manual refresh.
- Account research older than configured freshness threshold.
- Major new signal contradicts prior data.

## Required Inputs

- Account name/domain.
- Existing account record.
- Existing contacts/projects/opportunities/interactions.
- External evidence sources.

## Qualification / Decision Rule

No separate fit threshold: PB09 is a shared service. Depth mode should be `quick`, `standard`, or `deep` based on requesting workflow and strategic value.

---

# 4. State Machine

`QUEUED` → `SOURCE_GATHERING` → `ENTITY_VALIDATION` → `STRUCTURING` → `CONFLICT_REVIEW` → `COMPLETE` → `STALE`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Validate canonical company identity/domain/location and detect similarly named entities.
2. Gather only HSC-relevant facts: footprint, markets, locations, sectors, size range, Houston/Texas presence, expansion/construction activity, buyer roles, procurement/vendor clues.
3. Merge with internal HSC history: contacts, bids, proposals, jobs, revenue, relationship owner, last interaction.
4. Resolve known projects/properties and active signals.
5. Structure facts into fields with evidence references and freshness dates.
6. Identify conflicts between sources/internal data and flag for review rather than silently choosing.
7. Generate concise narrative summary and HSC Fit section.
8. Recommend likely motion: GC Pursuit, Development, Franchise, Facility Portfolio, Swarm, Monitor, or No Action.
9. Write fields back to AccountResearch snapshot and update safe canonical Account fields.

---

# 6. Outputs & Artifacts

- Structured AccountResearch object
- Evidence map
- Conflict list
- HSC fit summary
- Recommended motion

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

**Account Workspace → Research**: structured cards for Company, HSC Fit, People, Projects, Relationships, Signals, Evidence, Conflicts, and Recommended Motion. Each field supports “source / last verified / confidence.”

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

- Internal HSC transaction/history is authoritative for HSC-specific facts.
- Do not convert employee count/revenue estimates into precise facts.
- Do not research unrelated personal information.
- Keep “no evidence found” distinct from “false.”
- Prefer refresh of stale fields over rebuilding entire brief.

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

- `account_research.started`
- `account_research.conflict_found`
- `account_research.completed`
- `account_research.stale`

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

- Research runs
- Median completion time
- Fields with evidence
- Strategic accounts with fresh brief
- Duplicate research avoided
- Conflict resolution count

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

- Company rebrands.
- Parent/subsidiary confusion.
- Local office vs national company.
- Domain redirects.
- Acquisition changes ownership.
- No public footprint.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Research object has structured company/HSC-fit/people/projects/relationships/signals sections.
- **AC2.** Every externally derived material fact can point to evidence.
- **AC3.** Existing HSC won revenue is never overwritten by public estimates.
- **AC4.** Two sources disagreeing on company size produce a conflict/range, not fake precision.
- **AC5.** Rerun updates stale fields and preserves prior snapshot/history.
- **AC6.** Requesting workflow receives a stable machine-readable payload.

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

- [ ] Create AccountResearch schema/versioning.
- [ ] Implement depth modes and freshness policy.
- [ ] Implement evidence-linked field writer.
- [ ] Implement conflict detection.
- [ ] Build Research UI.
- [ ] Expose service to other Ploybooks.
- [ ] Add fixtures for parent/subsidiary and conflicting data.
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
/src/ploybooks/pb09/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb09/
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

> Implement **PB09 — Account Research Brief** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB10 — Incoming Bid

**Product:** HSC Growth OS v1  
**Ploybook:** PB10  
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

Turn an incoming bid invitation, portal notice, or uploaded package into a qualified tracked bid with a due date, owner, internal deadline, and next-step recommendation.

## Problem

Bid invitations arrive through email, portals, links, and attachments. Important deadlines and scope can be buried, duplicates occur, and estimator time gets spent before HSC decides whether the project actually fits.

## Goals

- Parse every incoming invitation into a consistent bid record.
- Determine whether signage/awning scope is actually relevant.
- Recommend BID / REVIEW / PASS quickly.
- Create internal deadlines and ownership.
- Hand accepted bids cleanly to PB11.

## Non-Goals

- Perform full takeoff—that belongs to PB11.
- Automatically accept portal invitations or submit pricing.
- Assume an invite equals a good opportunity.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When turn an incoming bid invitation, portal notice, or uploaded package into a qualified tracked bid with a due date, owner, internal deadline, and next-step recommendation., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Email classified as invitation to bid.
- Procore/BuildingConnected/other portal event.
- Manual upload/link.
- PB01 opportunity reaches bid-access stage.

## Required Inputs

- Email/message metadata.
- Attachments and accessible links.
- GC/project if pre-resolved.
- Due date, trade, scope, portal, contact if present.
- Existing project/account history.

## Qualification / Decision Rule

`bid_fit_score`: trade relevance 25, geography 15, project/account strategic value 15, estimated package potential 15, relationship 10, time available 10, HSC capacity 5, qualification readiness 5. BID ≥75; REVIEW 55–74; PASS <55, with override.

---

# 4. State Machine

`RECEIVED` → `PARSING` → `RESOLVED` → `QUALIFYING` → `NEEDS_REVIEW` → `ACCEPTED` → `PASSED` → `DOCUMENTS_COLLECTING` → `READY_FOR_ANALYSIS`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Ingest message/package and retain original source artifact.
2. Extract project name/address, GC, owner if present, bid due date/time/timezone, trade/scope phrases, portal/link, contact, prebid/site-walk dates, addendum process.
3. Resolve or create Account/Project/Opportunity without duplicating existing pursuit.
4. Detect whether invitation is a revision/addendum to an existing bid.
5. Calculate bid fit and explain decision factors.
6. Flag impossible/very short timing, out-of-area work, unclear scope, or qualification blockers.
7. Present BID / REVIEW / PASS recommendation and allow override reason.
8. On accept: create Bid record, assign estimator, set internal due date (configurable buffer), collect/store docs, and emit PB11 run.
9. On pass: store structured pass reason and optional GC relationship follow-up action.
10. Log acknowledgement/portal status when user manually takes action.

---

# 6. Outputs & Artifacts

- Parsed bid invite
- Bid-fit assessment
- Bid record
- Internal deadline/task
- Source document bundle

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

**Bid Inbox** with due date countdown, project/GC, scope, fit score, blockers, relationship, and `Bid / Review / Pass`. Accepted bid opens **Bid Workspace** with Overview, Documents, Analyzer, Estimate, QA, Submission, Follow-up tabs.

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

- Due date/timezone extraction is critical; ambiguous deadlines must require review.
- Treat addenda/revisions as updates, not new bids.
- Do not infer that “signage” includes awnings or vice versa.
- Preserve original invitation verbatim/document.
- Pass reason is required for learning when user overrides a high score.

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

- `bid.invite_received`
- `bid.invite_parsed`
- `bid.fit_scored`
- `bid.accepted`
- `bid.passed`
- `bid.documents_ready`

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

- Invites processed
- Median time to qualification
- Bid/Pass rate
- Override rate
- Missed deadline count
- Estimator hours avoided from passes
- Invite → submitted rate

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

- Deadline only appears in attachment.
- Portal link requires login.
- Same project invited by multiple GCs.
- Scope package changes name.
- Invite contains several divisions.
- Email is a reminder, not a new invite.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** One email with project/GC/due date creates or updates correct bid.
- **AC2.** Duplicate reminder does not create duplicate bid.
- **AC3.** Ambiguous deadline is blocking review.
- **AC4.** Accepted bid creates estimator task and PB11 run.
- **AC5.** Pass stores structured reason.
- **AC6.** Same project bid to two GCs can exist as two Bid records linked to one Project.

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

- [ ] Implement bid-invite classifier/parser.
- [ ] Create Bid Inbox.
- [ ] Implement project/account resolution.
- [ ] Implement bid-fit score.
- [ ] Create internal deadline logic.
- [ ] Wire document collection and PB11 event.
- [ ] Add email/portal/manual-upload fixtures.
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
/src/ploybooks/pb10/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb10/
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

> Implement **PB10 — Incoming Bid** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB11 — Bid Package Analyzer

**Product:** HSC Growth OS v1  
**Ploybook:** PB11  
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

Read the actual bid package and turn hundreds of pages into an evidence-linked estimator brief: relevant sheets/specs, scope, quantities where reliable, RFIs, alternates, exclusions, and risk flags.

## Problem

Estimators spend substantial time locating relevant pages and can miss addenda, scope language, or commercial requirements. AI can accelerate review, but inaccurate takeoffs or fabricated scope create financial risk; the product must emphasize traceability and confidence.

## Goals

- Index and classify bid documents.
- Identify all likely signage/awning-related sheets/spec sections.
- Produce an estimator brief with citations back to source pages.
- Surface ambiguity and risk early.
- Incrementally update when addenda arrive.

## Non-Goals

- Produce final unreviewed takeoff/pricing.
- Give legal advice.
- Silently interpret illegible drawings.
- Replace estimator judgment.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When read the actual bid package and turn hundreds of pages into an evidence-linked estimator brief: relevant sheets/specs, scope, quantities where reliable, RFIs, alternates, exclusions, and risk flags., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- PB10 accepted and documents available.
- New addendum/revised drawing uploaded.
- Manual rerun.

## Required Inputs

- Drawings PDFs.
- Specifications.
- Addenda.
- Scope sheets/bid forms.
- General/supplementary conditions.
- Known HSC estimating rules and standard exclusions.

## Qualification / Decision Rule

Document-level confidence is tracked per extraction. Quantity extraction can be `HIGH`, `MEDIUM`, `LOW`, or `NOT_RELIABLE`. Low-confidence quantities must not auto-populate pricing.

---

# 4. State Machine

`DOCUMENTS_INDEXING` → `SCOPE_LOCATING` → `EXTRACTING` → `RISK_REVIEW` → `ESTIMATOR_BRIEF_READY` → `ADDENDUM_UPDATE` → `HUMAN_REVIEWED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Fingerprint documents, detect revisions, extract page/sheet metadata, and build searchable index.
2. Classify documents: architectural drawings, signage package, specs, civil/site, electrical, structural, bid form, conditions, addenda.
3. Find relevant CSI/spec terms and drawing keywords; generate candidate relevant sheets.
4. Extract scope items with source page/sheet references and confidence.
5. Extract sign/awning schedule rows and quantities only when tabular/visual evidence is reliable; otherwise state manual takeoff required.
6. Identify alternates, allowances, unit prices, owner-furnished items, exclusions, and by-others scope.
7. Compare package requirements against HSC standard assumptions to flag electrical, engineering, permitting, bonding, insurance, retainage, liquidated damages, night work, certified payroll, warranty, mockups, delegated design, field verification, phasing, and unusual closeout.
8. Generate RFI candidates for contradictory or ambiguous requirements.
9. Create estimator brief with sections: project facts, relevant documents, scope, quantity table, assumptions, risks, RFIs, required forms, deadlines.
10. When addendum arrives, calculate impact delta: changed sheets/specs/scope/quantities/forms/deadline and mark prior extracted values stale where necessary.

---

# 6. Outputs & Artifacts

- Document index
- Relevant sheet/spec list
- Scope extraction table
- Quantity candidates
- Risk register
- RFI candidates
- Estimator brief
- Addendum impact report

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

**Bid Workspace → Analyzer**: split view with estimator brief and source document viewer. Every extracted scope/risk/quantity should click to source page/sheet. Confidence badge and `Confirm / Correct / Ignore` actions write feedback.

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

- No material scope claim without page/sheet source.
- Never call a quantity final unless confidence is high and human confirms.
- If drawing quality is poor, say manual review required.
- New addendum can invalidate earlier findings.
- Risk flags are review prompts, not legal conclusions.

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

- `bid_analysis.started`
- `bid_analysis.scope_found`
- `bid_analysis.risk_found`
- `bid_analysis.ready`
- `bid_analysis.corrected`
- `bid.addendum_received`
- `bid_analysis.addendum_delta_ready`

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

- Estimator prep time
- Relevant pages surfaced
- Human corrections/extraction
- Missed scope incidents
- Addendum misses
- Risk flags accepted
- AI quantity accuracy on reviewed samples

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

- Scanned image-only plans.
- Multiple drawing sets.
- Spec section uses unusual number/name.
- Sign schedule embedded as image.
- Addendum replaces entire package.
- Scope split among base bid/alternate.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Every estimator brief scope item has a document/page reference or is clearly labeled inferred.
- **AC2.** Low-confidence quantity cannot flow to pricing automatically.
- **AC3.** Addendum creates a delta report and marks affected prior findings.
- **AC4.** User can correct a scope item and correction persists.
- **AC5.** Analyzer surfaces at least standard HSC risk categories when present in fixture docs.
- **AC6.** Document viewer can jump from brief item to source page.

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

- [ ] Create document fingerprint/version model.
- [ ] Implement document classification/indexing.
- [ ] Implement evidence-linked extraction schema.
- [ ] Build standard HSC risk rules.
- [ ] Build estimator brief UI + source viewer links.
- [ ] Implement human correction feedback.
- [ ] Implement addendum delta logic.
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
/src/ploybooks/pb11/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb11/
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

> Implement **PB11 — Bid Package Analyzer** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB12 — Bid QA + Submission

**Product:** HSC Growth OS v1  
**Ploybook:** PB12  
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

Prevent preventable bid failures by validating required forms, addenda, pricing fields, commercial attachments, signatures, delivery method, and deadline before a human submits.

## Problem

A competitively priced bid can still be rejected because of a missing addendum acknowledgment, blank unit price, unsigned form, wrong delivery method, or late submission. These are preventable operational failures.

## Goals

- Generate a project-specific submission checklist.
- Differentiate blocking vs non-blocking issues.
- Ensure price/version and documents are frozen at submission.
- Record proof of submission.
- Create a clean handoff to PB13.

## Non-Goals

- Submit to portals automatically in v1.
- Judge whether HSC’s final price is commercially optimal.
- Override estimator/owner approval.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When prevent preventable bid failures by validating required forms, addenda, pricing fields, commercial attachments, signatures, delivery method, and deadline before a human submits., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Bid marked `Ready for QA`.
- Configured time before external deadline.
- Manual launch.

## Required Inputs

- Bid record.
- Latest bid form.
- Estimate/price version.
- Addenda list.
- Required attachments/forms.
- Submission instructions and deadline.
- HSC qualification docs.

## Qualification / Decision Rule

Checklist items have severity: `BLOCKER`, `WARNING`, `INFO`. `READY` is only possible with zero unresolved blockers and explicit human confirmation of final price/version.

---

# 4. State Machine

`QA_NOT_STARTED` → `CHECKING` → `BLOCKED` → `READY_FOR_APPROVAL` → `APPROVED_TO_SUBMIT` → `SUBMITTED` → `CONFIRMED` → `FAILED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Build checklist from bid package requirements + HSC standard submission checklist.
2. Validate external deadline/timezone and create countdown.
3. Validate latest addenda acknowledged and no newer package is unreviewed.
4. Validate base bid, alternates, allowances, unit prices, exclusions/clarifications, schedule, tax status, bond, signature, and required attachments.
5. Validate HSC documents are current (COI, W-9, licenses/certs where relevant).
6. Compare final bid form totals to approved estimate version and flag mismatches.
7. Validate submission method: portal, email, sealed bid, upload format, naming requirements.
8. Present blockers/warnings and require explicit resolution or documented override for non-blocking warning.
9. Create immutable submission snapshot containing files, values, approver, timestamp, and version hashes.
10. Human submits; user records confirmation screenshot/email/portal receipt or marks issue.
11. On confirmed submission, emit PB13 and lock submitted version from silent edits.

---

# 6. Outputs & Artifacts

- Bid QA checklist
- Blocker report
- Submission snapshot
- Submission confirmation record

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

**Bid Workspace → QA** with checklist grouped by Pricing, Addenda, Forms, Qualifications, Attachments, Delivery, Deadline. Large `READY / BLOCKED` status. Submission panel records method, recipient/portal, timestamp, confirmation artifact.

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

- Deadline uncertainty is a blocker.
- Missing mandatory addendum acknowledgment is a blocker.
- Final commercial price must be human-approved.
- Never treat an uploaded draft as submitted without confirmation.
- Post-submission edits create a new revision; do not mutate submitted snapshot.

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

- `bid.qa_started`
- `bid.qa_blocker_found`
- `bid.qa_ready`
- `bid.submission_approved`
- `bid.submitted`
- `bid.submission_confirmed`
- `bid.submission_failed`

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

- Preventable admin failures
- Bids blocked before bad submission
- Late submissions
- Submission confirmation rate
- QA duration
- Post-submission revision count

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

- GC extends deadline during QA.
- New addendum arrives after approval but before submission.
- Portal rejects file format.
- Email bounces.
- User submits outside system.
- Multiple alternates have separate forms.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Bid cannot reach READY with unresolved blocker.
- **AC2.** New addendum after QA invalidates READY state.
- **AC3.** Submitted snapshot is immutable/versioned.
- **AC4.** User can attach portal/email confirmation.
- **AC5.** External deadline and internal countdown show timezone.
- **AC6.** Confirmed submission automatically launches PB13.

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

- [ ] Create QA checklist schema/severity.
- [ ] Implement standard + project-specific checklist builder.
- [ ] Implement estimate/bid-form total comparison.
- [ ] Implement submission snapshot hashing/versioning.
- [ ] Build QA/submission UI.
- [ ] Add deadline invalidation and addendum hooks.
- [ ] Wire PB13 event.
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
/src/ploybooks/pb12/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb12/
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

> Implement **PB12 — Bid QA + Submission** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB13 — Bid Follow-Up / Award Watch

**Product:** HSC Growth OS v1  
**Ploybook:** PB13  
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

Keep every submitted bid alive until HSC knows the outcome, automate the follow-up cadence, detect status changes, and capture structured win/loss reasons.

## Problem

After a bid is submitted, follow-up becomes inconsistent. Many bids remain in “submitted” forever, HSC does not know who won or why, and valuable account intelligence is lost.

## Goals

- Ensure every submitted bid reaches a known outcome or explicit long-term monitoring state.
- Create timely but non-annoying follow-ups.
- Detect clarifications, shortlist, rebid, award, and cancellation signals.
- Capture structured reasons for wins/losses.
- Feed learnings into account strategy and scoring.

## Non-Goals

- Harass GCs with excessive messages.
- Guess award status without evidence.
- Treat lack of response as a loss.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When keep every submitted bid alive until HSC knows the outcome, automate the follow-up cadence, detect status changes, and capture structured win/loss reasons., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- `bid.submission_confirmed`.
- Manual launch on historical submitted bid.

## Required Inputs

- Bid/project/account.
- Submission date/amount.
- GC contact(s).
- Known construction schedule.
- Email/portal/project signals.
- Configured follow-up cadence.

## Qualification / Decision Rule

Default cadence: Day 2 receipt confirmation, Day 7 status, Day 14 status, Day 30 award check, then every 14–30 days based on project timeline. Cadence pauses on active conversation and can be account-specific.

---

# 4. State Machine

`SUBMITTED` → `RECEIPT_PENDING` → `ACTIVE_FOLLOWUP` → `CLARIFICATION` → `SHORTLISTED` → `REBID` → `AWARD_PENDING` → `WON` → `LOST` → `CANCELED` → `NO_DECISION` → `MONITORING`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Create follow-up schedule based on submission date, GC norms, project start, and user configuration.
2. Check recent interactions before creating each follow-up; suppress if already active.
3. Draft concise context-aware message: receipt, status, clarification, value-engineering, or award feedback.
4. Human approves sends in v1; log response and update state.
5. Monitor connected email/portal/public project signals for award, rebid, scope change, cancellation, or construction milestone.
6. When apparent award detected, require evidence or user confirmation before setting Won/Lost.
7. On Won: capture final value, expected margin, scope changes, reasons/relationships where known, and next operational handoff.
8. On Lost: capture structured reason categories: price, relationship, scope, qualification, capacity, timing, competitor/incumbent, project canceled, no feedback, other.
9. Generate account learning: GC hit rate, average award timing, loss pattern, contacts involved, competitor if verified.
10. Schedule future GC/account monitoring rather than discarding relationship.

---

# 6. Outputs & Artifacts

- Follow-up schedule
- Draft messages
- Status evidence
- Win/loss record
- Account learning update

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

**Bid Workspace → Follow-up**: current state, next scheduled action, last interaction, award evidence, timeline, and win/loss form. Account Workspace aggregates submitted/won/lost bids and reason distribution.

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

- No follow-up if a live conversation occurred within configured cooldown.
- Do not ask “any update?” repeatedly; vary purpose and reference actual project stage where possible.
- Unknown outcome stays unknown.
- Loss reason “price” should not be inferred solely because another vendor won.
- Structured feedback should never overwrite human notes.

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

- `bid.followup_scheduled`
- `bid.followup_due`
- `bid.followup_approved`
- `bid.status_signal_detected`
- `bid.won`
- `bid.lost`
- `bid.canceled`
- `bid.outcome_unknown`

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

- Bids with known outcome
- Median days from submission to known outcome
- Bid win rate
- Losses with reason
- Reply rate to follow-ups
- Awards recovered after follow-up
- GC-level hit rate

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

- Project repeatedly delays.
- GC never discloses award.
- Scope is rebid months later.
- Partial award.
- HSC wins only part of alternates.
- Bid amount changes after clarification.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Submitted bid receives configurable cadence.
- **AC2.** Recent reply suppresses scheduled follow-up.
- **AC3.** No evidence means system cannot auto-mark Lost.
- **AC4.** Partial award can be represented separately from full win/loss.
- **AC5.** Win/loss reason form supports structured category + notes + evidence.
- **AC6.** Outcome updates GC/account analytics.

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

- [ ] Create follow-up scheduler with pause/cooldown.
- [ ] Implement status signal ingestion.
- [ ] Build follow-up timeline UI.
- [ ] Create win/loss taxonomy + forms.
- [ ] Implement partial/rebid states.
- [ ] Add account-level bid analytics.
- [ ] Wire learning updates to scoring.
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
/src/ploybooks/pb13/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb13/
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

> Implement **PB13 — Bid Follow-Up / Award Watch** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

# PB14 — Proposal Deal Room

**Product:** HSC Growth OS v1  
**Ploybook:** PB14  
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

Replace static quote PDFs with a trackable, polished customer deal page containing scope, visuals, options, price, timeline, proof, documents, approval, and deposit actions.

## Problem

A PDF is static, hard to update, and gives HSC no visibility into buyer engagement. Larger signage/awning deals benefit from a living proposal that can be updated, shared internally, and used to trigger timely follow-up.

## Goals

- Create a professional web proposal from an approved quote.
- Keep commercial versions controlled and auditable.
- Track useful engagement signals.
- Make next steps obvious: approve, request change, pay deposit.
- Increase quote-to-close rate and reduce time to close.

## Non-Goals

- Replace QuickBooks accounting.
- Auto-change approved price.
- Expose internal margins/costs.
- Assume page views equal buying intent.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When replace static quote PDFs with a trackable, polished customer deal page containing scope, visuals, options, price, timeline, proof, documents, approval, and deposit actions., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Quote/proposal approved internally.
- Strategic opportunity manually promoted to deal room.

## Required Inputs

- Customer/account/project.
- Approved scope and price.
- Renderings/mockups.
- Options/alternates.
- Timeline.
- Warranty/terms.
- Relevant case studies.
- Deposit/payment link if available.

## Qualification / Decision Rule

Default for commercial opportunities above configured threshold (e.g., $5k) or strategic deals. Small commodity quotes can continue using lightweight flow.

---

# 4. State Machine

`DRAFT` → `INTERNAL_REVIEW` → `READY_TO_SEND` → `SENT` → `VIEWED` → `ENGAGED` → `REVISION_REQUESTED` → `APPROVED` → `DEPOSIT_PENDING` → `WON` → `EXPIRED` → `DECLINED`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Create proposal from canonical Opportunity + approved price version.
2. Generate structured sections: project, rendering, scope, options, exclusions, price, timeline, process, warranty, proof, documents, FAQs, CTA.
3. Validate every price and term against approved source record; AI cannot invent commercial terms.
4. Create versioned page and optionally downloadable PDF snapshot.
5. Human reviews and approves send.
6. Track unique link/session events, section views where reliable, documents opened, CTA actions, return visits, and sharing indicators.
7. Generate engagement-based follow-up recommendation, not automatic send.
8. Handle revision request by creating a new proposal version; preserve prior viewed/sent version.
9. On approval, record accepted scope/version and trigger deposit/invoice workflow integration when available.
10. On win/loss/expiry, retain audit trail and engagement analytics.

---

# 6. Outputs & Artifacts

- Deal room page
- Proposal versions
- PDF snapshot if needed
- Engagement timeline
- Approval/deposit record

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

Customer-facing page should be visually minimal and HSC-branded. Admin **Proposal Workspace** shows live preview, version history, commercial source, viewers/events, revision requests, and recommended follow-up. Never show internal analytics to customer.

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

- Price/terms come from approved structured data, not generated prose.
- Do not create false urgency.
- Viewer identification should be privacy-aware; distinguish known recipient link from anonymous session.
- Do not overreact to one page view.
- Every revision preserves previous version.

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

- `proposal.created`
- `proposal.approved_to_send`
- `proposal.sent`
- `proposal.viewed`
- `proposal.engaged`
- `proposal.revision_requested`
- `proposal.accepted`
- `proposal.deposit_started`
- `proposal.won`
- `proposal.expired`

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

- Proposal → won rate
- Median days to close
- Proposal engagement → win correlation
- Revision count
- Deposit conversion
- Average deal size
- Follow-up response time after high intent

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

- Customer forwards link.
- Price expires.
- Scope changes after approval.
- Multiple decision makers.
- Deposit is paid offline.
- Customer requests PDF only.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Rendered price exactly matches approved source.
- **AC2.** Revision creates new version; sent prior version remains accessible/auditable.
- **AC3.** Engagement events link to opportunity/proposal.
- **AC4.** High engagement creates recommendation, not automatic email.
- **AC5.** Approval/deposit action records exact accepted version.
- **AC6.** Expired proposal cannot silently accept stale commercial terms without review.

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

- [ ] Create proposal schema/versioning.
- [ ] Build customer deal-room template.
- [ ] Implement approved-commercial-data binding.
- [ ] Add engagement event tracking.
- [ ] Build admin proposal workspace.
- [ ] Implement revision/expiry flows.
- [ ] Integrate payment/invoice link abstraction.
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
/src/ploybooks/pb14/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb14/
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

> Implement **PB14 — Proposal Deal Room** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

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


---

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


---

# PB17 — Content Opportunity + Page Builder

**Product:** HSC Growth OS v1  
**Ploybook:** PB17  
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

Turn proven customer questions, search gaps, objections, and sales knowledge into useful HSC content pages that educate prospects and create qualified demand.

## Problem

HSC has valuable operational knowledge about permits, sign types, landlord criteria, timelines, pricing, awnings, and rollouts, but it is trapped in conversations. Generic AI blogging would add noise rather than authority.

## Goals

- Prioritize topics tied to real customer intent.
- Capture HSC-specific expertise and examples.
- Create a build-ready page, not just a text draft.
- Support both SEO and sales enablement.
- Measure assisted pipeline, not vanity traffic.

## Non-Goals

- Publish generic “10 sign ideas” content.
- Create content without subject-matter review when factual/local claims matter.
- Chase high-volume queries unrelated to commercial buyers.

---

# 2. Users & Primary Jobs

**Rameel / Growth:** decide whether to run this Ploybook, review evidence, approve consequential actions, and see the commercial outcome.  
**Sales:** consume research/actions, execute approved outreach, and log relationship context.  
**Estimator:** participates when the workflow creates or affects a bid.  
**System:** resolves entities, executes reusable actions, stores evidence, advances state, emits events, and updates shared context.

### Primary user story

> When turn proven customer questions, search gaps, objections, and sales knowledge into useful HSC content pages that educate prospects and create qualified demand., HSC should be able to execute the workflow from one workspace without recreating research or manually stitching systems together.

---

# 3. Trigger & Entry Conditions

## Triggers

- Search Console high-impression/low-click query.
- Repeated sales question/objection.
- Estimator/permit question repeated across jobs.
- PB18 content recommendation.
- Manual topic.

## Required Inputs

- Query/question/objection.
- Search data if available.
- HSC internal knowledge and project examples.
- Existing pages.
- Approved images.
- Target audience/CTA.

## Qualification / Decision Rule

Content score: commercial intent 25, frequency/customer relevance 20, HSC expertise advantage 20, search opportunity 15, sales enablement value 10, proof/assets 5, freshness gap 5.

---

# 4. State Machine

`IDEA` → `VALIDATING` → `BRIEF` → `SME_INPUT_NEEDED` → `DRAFT` → `REVIEW` → `APPROVED` → `PUBLISHED` → `MEASURING` → `REFRESH`

### State rules

- Every state transition must create an Activity event containing actor, timestamp, old state, new state, reason, and related entity IDs.
- Re-running the Ploybook resumes from the latest valid state unless user explicitly starts a fresh run.
- A failed tool/action moves only the affected step to `FAILED/NEEDS_REVIEW`; it must not corrupt the overall entity.
- Terminal states remain queryable and can create future child runs when new evidence appears.

---

# 5. End-to-End Workflow

1. Classify intent: research, pricing, permitting, comparison, process, rollout, troubleshooting, case study.
2. Check existing HSC content and choose update vs new page.
3. Gather evidence and internal HSC SME inputs; create explicit questions for missing expertise.
4. Create brief: audience, problem, answer, structure, proof, CTA, internal links, schema, visuals.
5. Draft content in HSC voice with concrete examples and short sections.
6. Generate page using existing web components and attach relevant HSC projects/images.
7. Run factual/claim/local-rule QA and SEO basics.
8. Human review/publish.
9. Connect page to sales workflows as shareable asset where relevant.
10. Measure qualified visits, CTA, assisted opportunity, usage in outbound/proposals, and refresh need.

---

# 6. Outputs & Artifacts

- Content opportunity
- SME question list
- Content brief
- Draft page
- QA report
- Sales-use metadata
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

**Growth → Content Pipeline** kanban/list with idea source, score, intent, target audience, SME owner, status, draft preview, page performance, and sales-use count. Existing content update opportunities should be visually distinct from new pages.

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

- HSC expertise beats generic research.
- If answer depends on local code/permitting, require evidence and date.
- No fabricated project examples.
- Avoid generic filler intros.
- Content should answer the question directly before expanding.

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

- `content.idea_created`
- `content.brief_ready`
- `content.sme_input_requested`
- `content.drafted`
- `content.approved`
- `content.published`
- `content.refresh_recommended`

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

- Qualified visits/content page
- Leads/page
- Assisted pipeline
- Sales asset shares
- Organic clicks
- Refresh rate
- Content production cycle time

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

- Topic overlaps local SEO page.
- Question has no meaningful search volume but high sales value.
- Permit rules vary by municipality.
- Old article has backlinks and should be updated instead of replaced.
- No usable image exists.

### Global failure rules

- Network/tool failure must be retryable.
- Missing data must not become fabricated data.
- Conflicting data should create a conflict record.
- Duplicate entity risk above threshold should request merge review.
- Partial completion is valid; surface what is complete and what is blocked.
- Never destroy prior human-entered data during an automated refresh.

---

# 14. Acceptance Criteria

- **AC1.** Every page has explicit audience, intent, CTA, and source idea.
- **AC2.** System checks existing content before creating new URL.
- **AC3.** Local factual claims require evidence/date.
- **AC4.** Missing SME knowledge creates input request rather than hallucination.
- **AC5.** Published page can be attached as asset in PB06/PB07/PB14.
- **AC6.** Performance includes pipeline/assisted metrics.

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

- [ ] Create ContentOpportunity pipeline.
- [ ] Implement existing-content overlap check.
- [ ] Build SME question/request flow.
- [ ] Create brief/page generator.
- [ ] Implement factual/SEO QA.
- [ ] Wire content assets into pursuit workflows.
- [ ] Build content performance view.
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
/src/ploybooks/pb17/
  definition.ts
  schema.ts
  scoring.ts
  steps/
  prompts/
  events.ts
  tests/

/src/components/ploybooks/pb17/
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

> Implement **PB17 — Content Opportunity + Page Builder** inside the existing HSC Growth OS architecture. Read the master PRD and this file first. Inspect the repository before choosing libraries or creating new abstractions. Reuse the shared entity, evidence, event, approval, and Ploybook-run models. Build the smallest end-to-end vertical slice that satisfies the acceptance criteria. Start with fixture/manual adapters where live integrations are unavailable. Do not implement autonomous external sends/submissions. Add tests before considering the Ploybook complete.


---

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


---

