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
