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
