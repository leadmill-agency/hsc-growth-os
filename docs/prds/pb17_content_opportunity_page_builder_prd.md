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
