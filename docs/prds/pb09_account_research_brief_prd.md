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
