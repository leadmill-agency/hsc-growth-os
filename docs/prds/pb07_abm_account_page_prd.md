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
