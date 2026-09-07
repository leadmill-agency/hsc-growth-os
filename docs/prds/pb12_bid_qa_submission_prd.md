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
