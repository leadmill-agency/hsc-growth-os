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
