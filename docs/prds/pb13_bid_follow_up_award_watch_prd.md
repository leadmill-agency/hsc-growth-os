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
