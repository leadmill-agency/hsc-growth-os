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
