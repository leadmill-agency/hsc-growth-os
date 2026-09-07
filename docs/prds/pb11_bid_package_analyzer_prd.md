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
