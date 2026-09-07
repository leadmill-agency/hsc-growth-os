# HSC Growth OS v1 — Master PRD

**Product:** HSC Growth OS  
**Company:** Houston Sign Crafters (HSC)  
**Version:** v1.0  
**Date:** September 6, 2026  
**Target MVP Ship Date:** September 30, 2026  
**Primary User:** Rameel / HSC growth + estimating team  
**Build Environment:** Claude Code  
**Status:** Build-ready  

---

# 1. Executive Summary

HSC Growth OS is an internal AI-native revenue operating system for Houston Sign Crafters.

Its job is not to be another CRM, another dashboard, or another collection of disconnected automations.

Its job is to continuously:

1. Find relevant revenue opportunities.
2. Decide which are worth pursuing.
3. Research the project, company, and people.
4. Create the correct pursuit strategy.
5. Prepare the collateral and outreach required to win.
6. Help HSC qualify and submit bids.
7. Follow opportunities until an outcome is known.
8. Learn which customers, projects, trades, channels, and actions create revenue.

The operating loop is:

> **FIND → PURSUE → WIN → LEARN**

The product consists of one shared data layer, one workflow/agent engine, and 18 reusable "Ploybooks" that execute common HSC growth motions.

The key product principle:

> **Do not build 18 mini-apps. Build one system where each Ploybook is a reusable workflow using shared data, tools, approvals, and state.**

---

# 2. Why This Exists

Today, much of HSC's growth process depends on humans remembering what to do next.

Examples:

- A new GC is discovered.
- Someone researches them.
- Someone finds people in Apollo.
- Someone checks for active projects.
- Someone writes outreach.
- Someone creates a proposal.
- Someone follows up.
- Someone forgets to follow up.
- A bid is lost.
- The reason is not captured.
- The next project appears and the process starts from zero again.

The same is true for:

- commercial developments
- franchise rollouts
- facility portfolios
- incoming bid invitations
- website visitors
- proposal follow-up
- SEO opportunities
- local market expansion
- account research
- win/loss analysis

HSC Growth OS converts these repeated operating procedures into executable workflows.

---

# 3. Product Goal

By September 30, 2026, HSC Growth OS v1 should be able to:

- surface new commercial opportunities
- rank them by HSC fit
- create structured company/project records
- launch reusable Ploybooks
- generate account/project research
- create contact maps
- draft outreach
- create personalized account pages
- ingest bid packages
- summarize signage/awning scope
- flag estimating and contract risks
- create structured bid checklists
- track submissions
- trigger follow-ups
- create deal-room style proposals
- generate local SEO/content opportunities
- produce a weekly Growth Operator brief
- require human approval before consequential actions
- write all activity and outcomes back to a shared system of record

The system is successful if it materially increases:

- qualified pipeline
- bid volume
- quote-to-close rate
- bid hit rate
- multi-location account penetration
- sales follow-up consistency
- estimator throughput
- organic inbound demand

---

# 4. Non-Goals for v1

Do not attempt to make v1 fully autonomous.

Do not build:

- a full replacement for QuickBooks
- a full replacement for HubSpot or existing CRM infrastructure
- a full replacement for Procore
- a full replacement for BuildingConnected
- a full replacement for estimating software
- an autonomous pricing engine that submits bids without review
- an autonomous email sender with no approval
- an autonomous advertising budget allocator
- a general-purpose website builder
- a full construction ERP
- a general-purpose AI agent platform for outside companies
- native mobile apps
- complex role-based enterprise security
- custom vector infrastructure unless clearly needed
- a bespoke browser automation framework if standard integrations suffice

v1 is an **internal decision + action layer**.

---

# 5. Core Product Principles

## 5.1 Project-first, not CRM-first

Traditional CRM:

> Company → Contact → Opportunity

Commercial construction often works more like:

> Project ↔ Company ↔ Person ↔ Role ↔ Trade ↔ Property ↔ Opportunity

The project graph is central.

---

## 5.2 Action over dashboards

Bad output:

> "You had 8,412 visitors."

Good output:

> "Richmond monument traffic increased 42%. Build a Richmond monument page and move $400 of search budget toward it."

Every major insight should lead to a recommended next action.

---

## 5.3 Human approval for expensive or irreversible actions

v1 may automatically:

- research
- summarize
- score
- generate drafts
- create internal records
- generate pages in draft
- prepare bid checklists
- schedule internal tasks

v1 should require approval before:

- sending email
- publishing public web content
- submitting a bid
- changing pricing
- changing ad spend
- creating legally binding commitments
- sending proposals
- changing an opportunity to won/lost if confidence is low

---

## 5.4 Evidence over hallucination

The system must distinguish:

- verified facts
- inferred facts
- assumptions
- missing data

Every research field should, where possible, store:

- source
- retrieved_at
- confidence
- verification status

Never silently convert assumptions into facts.

---

## 5.5 Shared context

Every Ploybook reads from and writes to the same core entities.

The same Harvey Cleary account should not be recreated independently by:

- GC Pursuit
- Incoming Bid
- Company Swarm
- Bid Follow-Up

All workflows should enrich the same account/project graph.

---

## 5.6 Reuse before custom logic

Ploybooks should be compositions of reusable actions:

- research_company
- research_project
- discover_contacts
- score_opportunity
- draft_email
- build_account_page
- analyze_bid_package
- create_task
- create_followup
- summarize_activity
- publish_content
- log_outcome

Avoid hardcoding whole workflows in one giant function.

---

# 6. Users

## 6.1 Rameel — Growth/Admin

Needs to:

- see highest-priority opportunities
- approve actions
- launch Ploybooks
- inspect account/project context
- review drafts
- review growth recommendations
- decide what HSC should pursue
- see pipeline and outcome metrics

Permissions:

- full access

---

## 6.2 Estimator

Needs to:

- receive qualified bid opportunities
- review bid-package summaries
- see relevant sheets/specs
- review exclusions
- complete pricing
- complete bid QA
- update bid state

Permissions:

- projects
- bids
- documents
- estimator tasks
- limited account data

---

## 6.3 Sales / Account Rep

Needs to:

- see assigned accounts
- review outreach
- log interactions
- follow up
- review proposal engagement
- update relationship status

Permissions:

- accounts
- contacts
- opportunities
- proposals
- outreach
- activity

---

## 6.4 Production / Operations

Not a primary v1 user.

May later receive won project handoff.

---

# 7. System Overview

```text
                            ┌─────────────────────────┐
                            │     SIGNAL SOURCES      │
                            │                         │
                            │ Permits                 │
                            │ GC bid notices          │
                            │ Email                   │
                            │ Website                 │
                            │ CRM                     │
                            │ Search / web            │
                            │ Construction databases  │
                            │ News / announcements    │
                            └────────────┬────────────┘
                                         │
                                         ▼
                            ┌─────────────────────────┐
                            │     INGEST + NORMALIZE   │
                            └────────────┬────────────┘
                                         │
                                         ▼
            ┌─────────────────────────────────────────────────┐
            │            HSC KNOWLEDGE GRAPH                  │
            │                                                 │
            │ Accounts                                        │
            │ Contacts                                        │
            │ Projects                                        │
            │ Properties                                      │
            │ Opportunities                                   │
            │ Bids                                            │
            │ Proposals                                       │
            │ Assets / Documents                              │
            │ Interactions                                    │
            │ Outcomes                                        │
            │ Relationships                                   │
            └────────────────────┬────────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────────┐
            │             PLOYBOOK ENGINE                     │
            │                                                 │
            │ Trigger                                         │
            │ Qualify                                         │
            │ Plan                                            │
            │ Execute steps                                   │
            │ Request approvals                               │
            │ Write state                                     │
            │ Record outcome                                  │
            └────────────────────┬────────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────────┐
            │                 ACTIONS                         │
            │                                                 │
            │ Research                                        │
            │ Draft outreach                                  │
            │ Build page                                      │
            │ Analyze docs                                    │
            │ Create estimate brief                           │
            │ Create tasks                                    │
            │ Generate proposal                               │
            │ Recommend follow-up                             │
            │ Publish approved content                        │
            └────────────────────┬────────────────────────────┘
                                 │
                                 ▼
            ┌─────────────────────────────────────────────────┐
            │                 FEEDBACK                        │
            │                                                 │
            │ Won / Lost                                      │
            │ Revenue                                         │
            │ Margin                                          │
            │ Reply                                           │
            │ Meeting                                         │
            │ Bid outcome                                     │
            │ Page engagement                                 │
            │ Conversion                                      │
            └─────────────────────────────────────────────────┘
```

---

# 8. Recommended Technical Architecture

This PRD should not force a rewrite of the existing HSC website.

If the existing HSC web app already uses a compatible modern stack, build into it.

Recommended default stack if no existing constraint blocks it:

## Frontend

- Next.js
- TypeScript
- Tailwind
- shadcn/ui or existing HSC design system

## Backend

- Next.js server actions/API routes OR dedicated Node service
- PostgreSQL
- Supabase acceptable for:
  - Postgres
  - auth
  - object storage
  - row-level permissions

## Workflow execution

Use a durable job/workflow mechanism.

Acceptable:

- Trigger.dev
- Inngest
- Temporal if already known
- database-backed internal job runner for MVP

Do not rely on a single synchronous HTTP request for long-running Ploybooks.

## AI abstraction

Create provider-agnostic functions.

Example:

```ts
interface LLMClient {
  generateStructured<T>(params): Promise<T>
  generateText(params): Promise<string>
}
```

Do not scatter direct model calls throughout the codebase.

## Storage

Documents:

- object storage
- metadata in Postgres
- extracted text stored separately

## Search / retrieval

Start with:

- Postgres full-text
- pgvector only if semantic retrieval is actually needed

Do not overengineer RAG before real use requires it.

---

# 9. Core Data Model

## 9.1 Account

Represents an organization.

Examples:

- Harvey Cleary
- HCA Houston Healthcare
- Dutch Bros
- University of Houston
- SmithGroup

Fields:

```ts
Account {
  id
  name
  slug
  account_type
  website
  domain
  phone
  headquarters
  service_area
  employee_range
  revenue_range
  industry
  notes
  strategic_value_score
  hsc_fit_score
  relationship_score
  prequalification_status
  owner_user_id
  created_at
  updated_at
}
```

Account types:

- general_contractor
- developer
- property_owner
- architect
- franchise
- franchisee
- facility_operator
- property_manager
- customer
- prospect
- vendor
- consultant
- other

---

## 9.2 Contact

```ts
Contact {
  id
  account_id
  first_name
  last_name
  title
  email
  phone
  linkedin_url
  role_type
  influence_score
  relationship_strength
  last_interaction_at
  source
  verified_at
}
```

Role types:

- estimator
- preconstruction
- project_manager
- project_executive
- superintendent
- procurement
- facilities
- real_estate
- construction
- operations
- marketing
- owner
- executive
- architect
- other

---

## 9.3 Project

```ts
Project {
  id
  name
  project_type
  address
  city
  state
  zip
  latitude
  longitude
  estimated_project_value
  square_footage
  stage
  start_date
  completion_date
  owner_account_id
  gc_account_id
  architect_account_id
  developer_account_id
  source
  source_url
  confidence
  created_at
  updated_at
}
```

Project stages:

- rumored
- announced
- planning
- design
- preconstruction
- bidding
- construction
- completed
- cancelled

---

## 9.4 Property

Persistent physical location.

```ts
Property {
  id
  name
  address
  city
  state
  zip
  owner_account_id
  property_manager_account_id
  type
  status
}
```

---

## 9.5 Opportunity

Commercial chance for HSC to win revenue.

```ts
Opportunity {
  id
  name
  account_id
  project_id
  property_id
  opportunity_type
  trade_scope
  estimated_value
  estimated_cost
  estimated_margin
  fit_score
  strategic_score
  relationship_score
  urgency_score
  overall_score
  stage
  owner_user_id
  next_action
  next_action_due_at
  source
  source_detail
  created_at
  updated_at
}
```

Stages:

- discovered
- researching
- qualified
- pursuing
- bid_invited
- estimating
- quote_ready
- submitted
- follow_up
- shortlisted
- won
- lost
- ignored

---

## 9.6 Bid

```ts
Bid {
  id
  opportunity_id
  due_at
  internal_due_at
  base_bid_amount
  alternates
  submitted_at
  submitted_by
  status
  win_probability
  competitor
  loss_reason
  award_amount
  notes
}
```

---

## 9.7 Proposal

```ts
Proposal {
  id
  opportunity_id
  version
  slug
  status
  subtotal
  tax
  total
  gross_margin_estimate
  public_token
  last_viewed_at
  view_count
  approved_at
  deposit_status
}
```

---

## 9.8 Interaction

```ts
Interaction {
  id
  account_id
  contact_id
  project_id
  opportunity_id
  type
  direction
  subject
  summary
  occurred_at
  source
  source_id
}
```

Types:

- email
- call
- meeting
- website_visit
- proposal_view
- bid_submission
- note
- task
- system_event

---

## 9.9 Document

```ts
Document {
  id
  project_id
  opportunity_id
  bid_id
  account_id
  filename
  document_type
  storage_url
  extracted_text_url
  checksum
  source
  version
  created_at
}
```

Document types:

- drawing
- specification
- addendum
- scope_sheet
- bid_form
- proposal
- contract
- insurance
- w9
- reference
- photo
- other

---

## 9.10 Relationship

Represents links beyond simple foreign keys.

```ts
Relationship {
  id
  from_entity_type
  from_entity_id
  relationship_type
  to_entity_type
  to_entity_id
  strength
  confidence
  source
}
```

Examples:

- person WORKS_FOR account
- account GC_ON project
- account ARCHITECT_ON project
- account OWNER_OF property
- contact INVOLVED_IN project
- HSC BID_ON project
- HSC WON project

---

## 9.11 Ploybook

```ts
Ploybook {
  id
  key
  name
  description
  version
  enabled
  trigger_types
  default_config
}
```

---

## 9.12 Ploybook Run

```ts
PloybookRun {
  id
  ploybook_id
  trigger_type
  trigger_payload
  primary_entity_type
  primary_entity_id
  status
  current_step
  started_at
  completed_at
  initiated_by
  result_summary
  error
}
```

Statuses:

- queued
- running
- waiting_for_approval
- paused
- completed
- failed
- cancelled

---

## 9.13 Ploybook Step

```ts
PloybookStep {
  id
  run_id
  step_key
  step_order
  status
  inputs
  outputs
  started_at
  completed_at
  error
}
```

---

## 9.14 Approval

```ts
Approval {
  id
  run_id
  step_id
  approval_type
  title
  summary
  proposed_action
  payload
  status
  requested_at
  resolved_at
  resolved_by
}
```

Statuses:

- pending
- approved
- rejected
- edited
- expired

---

## 9.15 Source Evidence

```ts
Evidence {
  id
  entity_type
  entity_id
  field_name
  value
  source_url
  source_name
  retrieved_at
  confidence
  verification_status
}
```

---

# 10. Shared Scoring Models

All scores should be transparent and inspectable.

Do not bury them in opaque LLM reasoning.

## 10.1 Opportunity Fit Score

0–100.

Suggested v1 weights:

| Factor | Weight |
|---|---:|
| Trade fit | 20 |
| Geography | 15 |
| Opportunity value | 15 |
| Customer / GC quality | 10 |
| Relationship | 10 |
| Timing | 10 |
| Capacity | 5 |
| Historical win likelihood | 5 |
| Strategic value | 10 |

Use configurable scoring bands.

Example:

- 85–100: pursue immediately
- 70–84: review today
- 50–69: monitor / selective pursuit
- <50: ignore unless strategic override

---

## 10.2 Account Strategic Score

Factors:

- potential annual revenue
- location count
- future project volume
- repeatability
- local concentration
- multi-trade fit
- payment quality if known
- relationship leverage
- brand/reference value

---

## 10.3 Contact Influence Score

Factors:

- role
- project involvement
- buying authority
- response history
- relationship strength
- proximity to award decision

---

# 11. Ploybook Definition Standard

Every Ploybook must contain:

```yaml
key:
name:
goal:
trigger:
inputs:
qualification:
steps:
tools:
artifacts:
approval_gates:
state_changes:
writebacks:
success_metric:
failure_conditions:
```

Every Ploybook should be readable as configuration even if implemented in code.

---

# 12. Ploybook Library

---

# PB01 — GC Pursuit

## Goal

Turn a discovered GC/project into a qualified signage or awning pursuit and maintain the account relationship across future projects.

## Trigger

- relevant GC project discovered
- manual account launch
- bid notice contains signage/awning scope
- existing GC returns to site
- new project tied to known GC

## Inputs

- GC
- project
- location
- trade/scope
- bid deadline if known
- source evidence

## Qualification

Score:

- geography
- trade fit
- project size
- GC quality
- relationship
- timing
- HSC capacity
- future account value

## Steps

1. Normalize/create GC account.
2. Normalize/create project.
3. Create opportunity.
4. Research GC.
5. Research project.
6. Identify project owner, architect, developer.
7. Check GC vendor/prequalification requirements.
8. Identify relevant project/bid contacts.
9. Build stakeholder map.
10. Create account readiness checklist.
11. Generate outreach draft.
12. Generate private GC capability page.
13. Request human approval to send/publish.
14. Track response.
15. If bid access granted, launch PB10 Incoming Bid.
16. If bid submitted, launch PB13 Bid Follow-Up.
17. Write relationship and outcome back to account.

## Artifacts

- account research brief
- project brief
- stakeholder map
- vendor readiness checklist
- outreach draft
- ABM/private page
- next-action plan

## Approval Gates

- send outreach
- publish/share page
- submit bid

## Success Metric

- qualified GC opportunities
- bid invitations
- first conversations
- bids submitted
- GC revenue
- GC account penetration

---

# PB02 — Commercial Development Pursuit

## Goal

Identify developments early and create multiple linked opportunities across developer, GC, owner, and tenants.

## Trigger

- new commercial development detected
- planning/permit signal
- developer announcement
- tenant announcement
- manual launch

## Inputs

- development/project
- property
- developer
- known tenants
- GC/architect if known

## Qualification

Favor:

- retail
- restaurant
- mixed-use
- medical
- multi-tenant
- Houston growth corridors
- developments with 5+ prospective signage opportunities

## Steps

1. Create project/property record.
2. Identify owner/developer.
3. Identify GC.
4. Identify architect.
5. Identify property manager.
6. Identify announced tenants.
7. Estimate likely unannounced tenant count.
8. Map likely HSC scopes:
   - monument
   - directional
   - building signage
   - awnings
   - tenant signage
9. Create development-level revenue estimate.
10. Create strategic account recommendation.
11. Generate developer/GC pursuit.
12. Create child tenant opportunities.
13. Monitor for new tenant announcements.
14. Automatically enrich development as new tenants appear.
15. Link won tenant jobs back to development.

## Artifacts

- development map
- stakeholder map
- tenant roster
- potential revenue estimate
- developer pitch page
- tenant opportunities

## Success Metric

- pipeline per development
- number of tenants penetrated
- development-level revenue

---

# PB03 — Franchise Expansion

## Goal

Turn brand expansion signals into multi-location signage programs.

## Trigger

- new location permit
- expansion announcement
- franchise disclosure/news
- existing customer opens another location
- manual launch

## Inputs

- brand
- franchisor
- franchisee if known
- location
- expansion geography

## Steps

1. Create franchise brand account.
2. Research existing footprint.
3. Identify Texas footprint.
4. Identify announced openings.
5. Identify franchisee groups.
6. Identify real estate/construction decision makers.
7. Research sign standards if public/available.
8. Determine buying path:
   - franchisor
   - franchisee
   - GC
   - developer
9. Score account.
10. Create rollout model:
    - survey
    - landlord approval
    - permit
    - fabrication
    - install
    - PM
11. Generate rollout account page.
12. Generate Company Swarm.
13. Create each location as project/property.
14. Track expansion and repeat work.

## Artifacts

- expansion map
- franchise relationship graph
- Texas rollout proposal
- location tracker
- outreach drafts

## Success Metric

- locations won
- revenue/brand
- percentage of brand openings captured

---

# PB04 — Facility Portfolio Pursuit

## Goal

Convert multi-location operators into recurring portfolio signage/service accounts.

## Trigger

- target operator identified
- existing customer with multiple locations
- new facilities/contact signal
- manual launch

## Inputs

- operator
- known locations
- facilities/construction contacts

## Steps

1. Identify full location portfolio.
2. Normalize properties.
3. Identify facilities, construction, procurement, real estate contacts.
4. Research current vendors where possible.
5. Identify expansion/remodel/rebrand signals.
6. Score portfolio.
7. Create centralized signage program pitch.
8. Generate account page.
9. Generate Company Swarm.
10. Create location-level opportunities.
11. Monitor permits/openings/remodels.
12. Track service and rollout revenue.

## Artifacts

- location map
- account brief
- portfolio proposal
- contact map
- opportunity list

## Success Metric

- annual recurring/repeat revenue
- locations serviced
- portfolio penetration

---

# PB05 — Opportunity Radar

## Goal

Continuously find and rank new HSC revenue opportunities.

## Trigger

- scheduled daily
- manual refresh

## Inputs

Potential sources:

- bid notices
- permit feeds
- construction databases
- web
- company news
- development announcements
- franchise news
- CRM
- email
- website intent

## Steps

1. Pull recent signals.
2. Deduplicate.
3. Resolve companies/projects/properties.
4. Classify opportunity type.
5. Determine HSC trade relevance.
6. Score.
7. Create suggested opportunities.
8. Suppress low-quality duplicates.
9. Display "Why this matters."
10. Suggest relevant Ploybook.

## UI Output

```text
91 — Harvey / Healthcare / Signage
87 — 18-store restaurant rollout
76 — Richmond retail development
72 — Hospital renovation
34 — Small single-tenant shop
```

## Approval

User chooses:

- Pursue
- Monitor
- Ignore

## Success Metric

- qualified opportunities created/week
- opportunity → bid rate
- opportunity → revenue rate

---

# PB06 — Company Swarm

## Goal

Create a coordinated multi-contact account pursuit.

## Trigger

- account marked strategic
- GC pursuit needs relationship depth
- franchise/facility account launched
- manual launch

## Inputs

- account
- project/opportunity
- known contacts

## Steps

1. Determine relevant personas.
2. Discover missing contacts.
3. Rank influence.
4. Determine hook for each person.
5. Choose outreach timing.
6. Draft distinct messages.
7. Attach relevant assets/pages.
8. Create staggered follow-up plan.
9. Request approval.
10. Log responses.
11. Adjust contact priority.

## Rule

Do not send identical messages to multiple people.

## Success Metric

- conversation rate/account
- meetings/account
- number of active relationships/account

---

# PB07 — ABM Account Page

## Goal

Generate a private, relevant page for a specific account/project.

## Trigger

- strategic account
- GC pursuit
- franchise pursuit
- facility pursuit
- manual launch

## Inputs

- account
- project/opportunity
- relevant HSC capabilities
- HSC proof/case studies

## Page Structure

1. Account-specific headline.
2. Relevant HSC capabilities.
3. Relevant projects.
4. Local manufacturing/installation.
5. Certifications.
6. Project/account-specific context.
7. Downloadable qualification docs where appropriate.
8. One CTA.

## Rules

- private/noindex by default
- do not fabricate personalization
- use relevant proof only
- no generic AI flattery
- track account-level page activity

## Success Metric

- page engagement
- page → response
- page → bid/meeting

---

# PB08 — High-Intent Visitor

## Goal

Convert high-value website intent into outbound action.

## Trigger

- identified company visits key pages
- repeat visits
- proposal/deal-room engagement
- high-intent behavior threshold

## Inputs

- company
- pages visited
- visit frequency
- existing CRM/account state

## Steps

1. Resolve company.
2. Check whether already customer/prospect.
3. Score intent.
4. Research account.
5. Check current projects/openings.
6. Identify likely buyer.
7. Draft relevant outreach.
8. Suggest Company Swarm if high strategic value.
9. Request approval.

## Intent Examples

High:

- multi-location
- commercial awnings
- monument signs
- pricing
- proposal pages
- portfolio solutions
- repeat project visits

Low:

- careers
- blog-only
- accidental visits

## Success Metric

- identified visitor → conversation
- identified visitor → quote

---

# PB09 — Account Research Brief

## Goal

Generate one reusable research object for an account.

## Trigger

- any Ploybook requires account research
- manual launch

## Output

```text
COMPANY
Locations
Size
Markets
Houston presence

HSC FIT
Relevant products
Potential spend
Repeatability

PEOPLE
Relevant contacts

PROJECTS
Known current work

RELATIONSHIPS
Past contact
Past bids
Past wins

SIGNALS
Permits
Projects
News
Visits

RECOMMENDED MOTION
```

## Writeback

Structured account fields, not just prose.

## Success Metric

- research time saved
- percentage of strategic accounts with current research

---

# PB10 — Incoming Bid

## Goal

Convert an inbound bid package/invite into a qualified, tracked opportunity.

## Trigger

- email containing bid invitation
- Procore/BuildingConnected invite
- manual upload
- opportunity promoted to bid stage

## Inputs

- invitation
- attachments/links
- due date
- project
- GC
- trade

## Steps

1. Parse invitation.
2. Create/update project.
3. Create opportunity.
4. Extract due date.
5. Determine signage/awning relevance.
6. Score bid fit.
7. Recommend:
   - BID
   - REVIEW
   - PASS
8. If approved:
   - create bid record
   - internal deadline
   - assign estimator
   - download/store docs
   - launch PB11

## Success Metric

- bid invites processed
- response time
- percentage qualified correctly
- estimator time saved

---

# PB11 — Bid Package Analyzer

## Goal

Read plans/specs/addenda and create a reliable estimator brief.

## Trigger

- PB10 accepted
- new documents/addenda uploaded

## Inputs

- drawings
- specifications
- addenda
- scope sheets
- bid forms

## Steps

1. Index documents.
2. Identify relevant spec sections.
3. Identify relevant plan sheets.
4. Extract signage/awning scope.
5. Identify quantities where reliable.
6. Identify alternates.
7. Identify exclusions.
8. Identify ambiguous scope.
9. Identify RFIs.
10. Flag commercial/legal/operational risks.
11. Create estimator brief.
12. Update on each new addendum.

## Risk Flags

Examples:

- electrical hookup
- engineering
- permits
- bonding
- certified payroll
- night work
- retainage
- liquidated damages
- unusual warranty
- delegated design
- mockups
- owner-furnished material
- final field verification
- unusual insurance

## Rule

Quantities extracted by AI must be labeled with confidence and reviewed.

## Success Metric

- estimator hours/bid
- missed scope
- addendum misses
- pricing errors

---

# PB12 — Bid QA + Submission

## Goal

Prevent avoidable administrative bid failures.

## Trigger

- bid ready for submission

## Checklist

- base bid complete
- alternates complete
- addenda acknowledged
- bid form complete
- exclusions complete
- unit prices complete
- schedule complete
- tax status
- bond
- W-9
- COI
- certifications
- signature
- deadline
- delivery method

## Output

- READY
- NOT READY

With blocking issues.

## Approval

Human submits.

System logs:

- submission timestamp
- amount
- version
- recipient/portal
- confirmation

## Success Metric

- zero preventable administrative bid failures

---

# PB13 — Bid Follow-Up / Award Watch

## Goal

Track every submitted bid until award status is known.

## Trigger

- bid submitted

## Cadence

Default:

- Day 2: receipt confirmation
- Day 7: status follow-up
- Day 14: follow-up
- Day 30: award check
- continue if project remains active

Cadence should be configurable.

## Steps

1. Monitor email/project status.
2. Draft follow-up.
3. Detect shortlist/clarifications.
4. Update bid stage.
5. Detect award if possible.
6. If lost:
   - competitor
   - price
   - relationship
   - scope
   - timing
   - qualification
   - other reason
7. Store structured loss reason.
8. Update account/project intelligence.

## Success Metric

- bids with known outcome
- bid win rate
- losses with known reason

---

# PB14 — Proposal Deal Room

## Goal

Replace static proposals with trackable interactive deal pages.

## Trigger

- quote ready
- strategic opportunity

## Page Sections

- customer/project
- renderings
- scope
- options
- price
- timeline
- warranty
- relevant projects
- documents
- exclusions
- FAQs
- approval action
- deposit action

## Tracking

- unique viewers
- total views
- last view
- sections viewed
- documents opened
- return visits

## Intent Triggers

Examples:

- 3+ visits in 24h
- pricing viewed repeatedly
- multiple stakeholders
- return after inactivity

Trigger sales follow-up recommendation.

## Success Metric

- proposal → won
- time to close
- engagement → win correlation

---

# PB15 — Business Case / Deal Progression

## Goal

Help a champion sell a large HSC engagement internally.

## Trigger

- strategic deal
- rollout
- facility portfolio
- large awning/sign program
- deal stalled because internal justification is needed

## Inputs

- confirmed requirements
- current-state costs
- vendor count
- schedule
- rollout scope
- risk
- assumptions

## Output

- current state
- proposed HSC model
- confirmed facts
- assumptions
- financial ranges
- operational benefits
- risk reduction
- implementation plan
- next decision

## Rule

Separate confirmed numbers from assumptions.

## Success Metric

- large-deal progression
- enterprise close rate

---

# PB16 — Programmatic Local SEO

## Goal

Create high-value local landing pages based on actual search and market opportunity.

## Trigger

- keyword/location opportunity
- scheduled SEO scan

## Matrix

Geography × Product × Customer Type

Examples:

- Richmond × Monument Signs
- Katy × Channel Letters
- Cypress × Restaurant Signs
- Houston × Commercial Awnings

## Steps

1. Identify keyword cluster.
2. Check existing coverage.
3. Check demand/strategic value.
4. Gather unique local context.
5. Pull relevant HSC projects/photos.
6. Include permit/local information where useful.
7. Generate page.
8. Add internal links.
9. Add structured data.
10. Human review.
11. Publish.
12. Track rankings/leads.

## Rules

Do not mass-publish near-duplicate pages.

Every page must contain enough unique value to justify existence.

## Success Metric

- qualified organic leads
- organic pipeline
- revenue/page

---

# PB17 — Content Opportunity + Page Builder

## Goal

Turn real audience demand into useful content/pages.

## Trigger

- Search Console gap
- repeated customer question
- sales objection
- high-impression low-click query
- manual idea

## Steps

1. Identify opportunity.
2. Determine search/sales intent.
3. Research.
4. Create brief.
5. Draft content.
6. Add HSC examples.
7. Add images/projects.
8. Add schema.
9. Generate page.
10. Human approve.
11. Publish.
12. Measure.

## Good Content Examples

- Channel letter cost in Houston
- Monument sign permitting in Harris County
- How long commercial sign permitting takes
- Awnings vs canopies
- Landlord sign criteria explained
- How national franchise signage rollouts work

## Success Metric

- qualified visits
- assisted pipeline
- leads/page

---

# PB18 — Growth Operator

## Goal

Serve as HSC's weekly AI growth operator.

## Trigger

- weekly Monday
- manual run

## Inputs

- revenue
- pipeline
- opportunities
- bids
- proposals
- website
- SEO
- ads
- outreach
- wins/losses
- account activity

## Output

```text
HSC GROWTH BRIEF

REVENUE
Booked revenue
Cash collected
Pipeline added

OPPORTUNITIES
Discovered
Pursued
Ignored
Bids created

SALES
Quote → Won
Bid → Won
Average deal
Sales cycle

MARKETING
Paid lead quality
Organic traffic
Organic pipeline
High-intent visitors

WHAT CHANGED
3–7 meaningful observations

WHAT I RECOMMEND
Ranked actions

[Approve]
```

## Action Model

Each recommendation should point to a runnable Ploybook.

Example:

> "3 new Richmond developments detected."

Action:

> Launch PB02 on selected developments.

## Success Metric

- approved recommendation rate
- revenue/pipeline from recommendations

---

# 13. Shared Action Library

Implement these as reusable actions.

## Research

- research_account
- research_project
- research_property
- research_market
- find_contacts
- find_projects
- find_locations
- check_prequalification
- check_relationship_history

## Scoring

- score_account
- score_opportunity
- score_contact
- score_bid

## Content

- draft_email
- draft_followup
- build_account_page
- build_deal_room
- build_business_case
- build_seo_page
- generate_research_brief

## Bid

- parse_bid_invite
- ingest_document
- classify_document
- extract_relevant_sheets
- extract_spec_sections
- generate_estimator_brief
- detect_bid_risks
- generate_bid_qa

## CRM / workflow

- create_account
- create_project
- create_property
- create_opportunity
- create_bid
- create_task
- update_stage
- log_interaction
- create_approval
- schedule_followup

## Monitoring

- monitor_account
- monitor_project
- monitor_bid
- monitor_proposal
- monitor_website_intent

---

# 14. UI / Information Architecture

Primary navigation:

```text
Growth
├── Home
├── Opportunities
├── Accounts
├── Projects
├── Bids
├── Proposals
├── Ploybooks
├── Approvals
└── Insights
```

Secondary:

```text
Settings
├── Integrations
├── HSC Knowledge
├── Scoring
├── Ploybook Config
└── Users
```

---

# 15. Screen Specifications

# 15.1 Home — Growth Command Center

Purpose:

Show only the most important things requiring attention.

Sections:

## KPI Strip

- Active pipeline
- New pipeline this month
- Quotes submitted
- Bids submitted
- Won revenue
- Average fit score

## Needs You

Cards for pending approvals.

Examples:

- review outreach
- review bid
- approve page
- approve follow-up
- publish content

## New Opportunities

Top opportunity cards:

- score
- project/account
- type
- reason
- estimated value
- due date
- source

Actions:

- Pursue
- Monitor
- Ignore

## Agents Running

- Ploybook name
- entity
- status
- current step

## Recommended Actions

Generated by PB18.

---

# 15.2 Opportunity Inbox

Filters:

- score
- type
- stage
- source
- geography
- product
- due date
- owner
- strategic account

Card/list fields:

- opportunity
- account
- project
- score
- value
- type
- source
- urgency
- why it matters
- next action

Bulk actions:

- Pursue
- Monitor
- Ignore
- Assign

---

# 15.3 Opportunity Workspace

Tabs:

- Overview
- Account
- Project
- People
- Research
- Activity
- Bid
- Proposal
- Documents
- AI Actions

Top:

- stage
- value
- score
- due date
- next action

AI panel:

> "What should I do next?"

Must answer with concise action(s), not a long narrative.

---

# 15.4 Account Workspace

Header:

- account
- type
- strategic score
- fit score
- relationship score
- owner
- status

Tabs:

- Overview
- Contacts
- Projects
- Opportunities
- Relationships
- Activity
- Pages
- Documents
- Intelligence

Show:

- current pursuits
- past bids
- wins/losses
- contacts
- website visits
- known locations
- recommended next motion

---

# 15.5 Project Workspace

Header:

- project
- address
- stage
- project value
- GC
- owner
- architect
- developer

Tabs:

- Overview
- Companies
- Contacts
- Opportunities
- Documents
- Activity

Graph view optional after core table view works.

---

# 15.6 Bid Workspace

Header:

- project
- GC
- due date
- status
- amount
- estimator

Tabs:

- Overview
- Scope
- Drawings
- Specs
- Risks
- RFIs
- Estimate
- QA
- Submission
- Activity

Key component:

**Estimator Brief**

---

# 15.7 Proposal Deal Room Admin

Show:

- proposal status
- value
- customer
- views
- viewers
- last viewed
- approval
- deposit

Actions:

- preview
- edit
- send
- duplicate
- archive

---

# 15.8 Ploybooks

Cards:

- name
- description
- enabled
- last run
- success metric

Click:

- description
- triggers
- steps
- approvals
- configuration
- run history
- manual run

---

# 15.9 Approvals

One inbox.

Approval card:

```text
TYPE
Send outreach

ACCOUNT
Harvey Cleary

REASON
Public bid contains signage scope.

DRAFT
[editable email]

ACTIONS
Approve
Edit
Reject
```

Support:

- approve one
- reject one
- edit + approve
- bulk approve low-risk internal actions only

---

# 16. Approval Policy

## Auto-execute

- create internal records
- research
- score
- summarize
- create internal tasks
- draft content
- draft email
- extract documents
- generate QA
- monitor public sources

## Human approval required

- send email
- publish public content
- send proposal
- submit bid
- change price
- update ad spend
- contact more than one person in same account at once
- mark opportunity won/lost if confidence < configured threshold

---

# 17. HSC Knowledge Base

The system needs stable HSC context.

Store:

## Company

- Houston Sign Crafters
- Houston-based
- UL-listed
- service territory
- phone/email
- website

## Capabilities

- channel letters
- cabinet signs
- monument signs
- pylon signs
- interior signage
- vinyl
- wall graphics
- awnings
- canopies
- permitting
- installation
- surveys
- project management

## Differentiators

- local fabrication
- permit management
- landlord/HOA coordination where applicable
- UL capability
- warranty
- local install
- free mockups when applicable

## Commercial documents

- W-9
- COI
- certifications
- references
- qualification forms
- warranty
- standard exclusions

## Proof

- project portfolio
- images
- case studies
- customer type
- project value
- products used
- location

## Messaging rules

Cold outreach:

- short
- direct
- 100–150 words
- why HSC is reaching out
- evidence research was done
- no generic flattery
- one clear CTA

---

# 18. Integrations

Prioritize by value.

## Tier 1 — September

- existing website
- CRM / lead database
- Gmail/email
- file storage
- analytics
- Search Console if available
- QuickBooks read access if practical
- existing proposal data

## Tier 2

- Apollo
- Google Ads
- Meta Ads
- permit data
- construction databases
- visitor identification

## Tier 3

- BuildingConnected
- Procore
- Dodge / ConstructConnect
- other bid platforms

Do not block v1 on expensive construction integrations.

Manual upload/email forwarding is acceptable for MVP.

---

# 19. Document Processing

Bid package processing is high risk.

Workflow:

1. Upload/store original file.
2. Extract text.
3. Classify document.
4. Preserve page references.
5. Produce structured findings.
6. Store findings with source page.
7. Show confidence.
8. Require estimator verification for quantities/pricing.

Never overwrite source files.

For addenda:

- create new version
- compare against prior documents
- flag changed scope
- flag new deadlines
- flag newly required forms

---

# 20. Event System

All important actions should emit events.

Examples:

```text
account.created
project.created
opportunity.discovered
opportunity.pursued
bid.invited
bid.documents_added
bid.ready_for_qa
bid.submitted
bid.won
bid.lost
proposal.viewed
proposal.approved
email.replied
account.high_intent_visit
content.opportunity_detected
```

Ploybook triggers should subscribe to these.

---

# 21. Activity Feed

Every entity should have chronological activity.

Example:

```text
Sep 12 09:14 — Opportunity discovered
Sep 12 09:16 — Fit scored 87
Sep 12 09:17 — GC research completed
Sep 12 09:20 — Outreach drafted
Sep 12 10:03 — Rameel approved outreach
Sep 12 10:04 — Email sent
Sep 12 14:42 — Reply received
Sep 12 14:44 — Bid invite created
```

No black-box automation.

---

# 22. Agent Output Standard

Every agent response should be:

1. concise
2. structured
3. evidence-aware
4. action-oriented

Preferred format:

```text
SUMMARY

WHY IT MATTERS

KNOWN

UNKNOWN

RECOMMENDED ACTION

RISKS

SOURCES
```

Avoid verbose prose.

---

# 23. Error Handling

For every Ploybook run:

- retries
- visible failed step
- error message
- resume from failed step
- no duplicate sends
- idempotent record creation
- source deduplication

If a workflow partially fails:

- preserve successful work
- surface exact failure
- allow retry

---

# 24. Observability

Track:

- run count
- run success
- run duration
- failed steps
- AI cost/run
- external API cost
- approval rate
- output acceptance rate
- human edits
- revenue outcomes

This matters because we eventually need to know:

> Which Ploybooks actually make money?

---

# 25. Security

v1 requirements:

- authenticated users
- server-side secrets
- no API keys exposed client-side
- signed/private proposal URLs
- private ABM pages noindex
- access control by user role
- audit log for outbound actions
- encrypted provider credentials
- secure document storage

Do not expose financial docs, W-9s, COIs, or bid docs publicly.

---

# 26. September Build Plan

Current date: September 6, 2026.

Target: September 30.

---

## Phase 0 — Sep 6–8

### Goal

Core architecture.

### Build

- database schema
- auth
- core nav
- accounts
- contacts
- projects
- opportunities
- activity feed
- evidence model
- Ploybook definition
- Ploybook run model
- approval model
- job runner
- AI abstraction
- HSC knowledge base

### Acceptance Criteria

- can create account/project/opportunity
- can launch dummy Ploybook
- run shows steps
- run can pause for approval
- approval can resume run
- all activity logged

---

## Phase 1 — Sep 9–12

### Build

PB01 GC Pursuit  
PB05 Opportunity Radar  
PB09 Account Research

### Acceptance Criteria

Take one real Houston GC opportunity and:

- create project
- create GC
- score it
- research it
- identify relevant people
- identify prequalification requirements
- generate outreach
- generate account page draft
- ask for approval

---

## Phase 2 — Sep 13–15

### Build

PB02 Commercial Development  
PB03 Franchise Expansion  
PB04 Facility Portfolio

### Acceptance Criteria

For one live example of each:

- create parent account/project
- map related entities
- generate child opportunities
- calculate strategic value
- produce pursuit recommendation

---

## Phase 3 — Sep 16–18

### Build

PB06 Company Swarm  
PB07 ABM Account Page  
PB08 High-Intent Visitor

### Acceptance Criteria

- generate 3–5 distinct contact messages for one account
- generate private account page
- record page engagement
- turn a high-intent account visit into outreach recommendation

---

## Phase 4 — Sep 19–22

### Build

PB10 Incoming Bid  
PB11 Bid Package Analyzer  
PB12 Bid QA

### Acceptance Criteria

Using one historical/active HSC bid package:

- ingest invitation
- create bid
- extract due date
- identify relevant docs
- summarize relevant scope
- identify risks
- generate estimator brief
- generate QA checklist

Critical:

Human must validate before relying on output.

---

## Phase 5 — Sep 23–24

### Build

PB13 Bid Follow-Up  
PB14 Proposal Deal Room  
PB15 Business Case

### Acceptance Criteria

- submitted bid automatically creates follow-up plan
- one proposal can be viewed at private URL
- view activity is logged
- strategic deal can generate business-case draft

---

## Phase 6 — Sep 25–27

### Build

PB16 Programmatic Local SEO  
PB17 Content Opportunity

### Acceptance Criteria

- find one real SEO gap
- generate one location/product page
- generate one informational content page
- both remain draft until approved
- publish after approval

---

## Phase 7 — Sep 28–30

### Build

PB18 Growth Operator  
stability  
QA  
integrations  
analytics

### Acceptance Criteria

Weekly brief reads actual system data and recommends:

- opportunities to pursue
- bids to follow up
- pages to publish
- accounts to contact

Each recommendation links to a runnable action/Ploybook.

---

# 27. Definition of Done for September

A Ploybook counts as "built" when:

1. It has a real trigger.
2. It accepts real HSC data.
3. It executes end-to-end.
4. It writes structured results into the common data model.
5. It pauses at required approvals.
6. It logs activity.
7. It has at least one real HSC example tested.
8. It exposes failure visibly.
9. It records success metric data.

A Ploybook does **not** need:

- perfect autonomy
- polished animations
- every possible integration
- zero human involvement
- sophisticated machine learning

---

# 28. Priority Ranking

If schedule slips, preserve in this order:

## Tier A — Must work well

1. PB01 GC Pursuit
2. PB05 Opportunity Radar
3. PB10 Incoming Bid
4. PB11 Bid Package Analyzer
5. PB13 Bid Follow-Up
6. PB14 Proposal Deal Room
7. PB18 Growth Operator

## Tier B — Must exist as usable MVP

8. PB02 Commercial Development
9. PB03 Franchise Expansion
10. PB04 Facility Portfolio
11. PB06 Company Swarm
12. PB07 ABM Account Page
13. PB09 Account Research

## Tier C — Can be thinner in September

14. PB08 High-Intent Visitor
15. PB12 Bid QA
16. PB15 Business Case
17. PB16 Programmatic SEO
18. PB17 Content Opportunity

Do not sacrifice Tier A quality merely to check all 18 boxes.

---

# 29. Metrics Dashboard

## Business

- new qualified pipeline/week
- revenue won from OS-sourced opportunities
- pipeline/source
- average opportunity value
- repeat-account revenue
- franchise locations won
- development penetration

## Sales

- opportunity → conversation
- conversation → quote
- quote → won
- bid invite → bid submitted
- bid submitted → won
- average sales cycle
- follow-up compliance

## Estimating

- estimator hours/bid
- bids/week
- average bid size
- missed addenda
- scope errors
- administrative bid failures

## Marketing

- organic qualified leads
- revenue/SEO page
- high-intent account visits
- visitor → conversation
- paid source → won revenue

## Ploybook

- runs
- approval rate
- human edit rate
- completion rate
- revenue influenced
- cost/run

---

# 30. Learning Loop

The system should progressively learn from outcomes.

v1:

Rule-based analytics.

Examples:

- win rate by GC
- win rate by product
- win rate by project size
- win rate by geography
- win rate by lead source
- win rate by estimator
- margin by customer type
- sales cycle by account type

Later:

Predictive scoring.

Do not claim ML intelligence before enough data exists.

---

# 31. Example End-to-End Flow

Signal:

> Public notice indicates Harvey Cleary is bidding a University of Houston project with signage scope.

## PB05 Opportunity Radar

Creates:

- project
- account
- opportunity
- score 84

Recommendation:

> Pursue.

User clicks Pursue.

## PB01 GC Pursuit

Runs:

- GC research
- project research
- stakeholder map
- prequalification check
- outreach draft
- private page

Approval:

> Send bid access request?

Approved.

Email reply arrives with bid package.

## PB10 Incoming Bid

Creates:

- bid
- due date
- estimator assignment

## PB11 Bid Package Analyzer

Creates:

- relevant drawings
- relevant specs
- scope summary
- RFIs
- risk flags
- estimator brief

Estimator completes pricing.

## PB12 Bid QA

Checks submission.

Human submits.

## PB13 Bid Follow-Up

Tracks until award.

If won:

- account relationship strengthened
- project converted to production handoff later
- revenue recorded
- future Harvey opportunities get higher relationship score

If lost:

- structured reason recorded
- Harvey account remains strategic
- future opportunity starts with accumulated context

This is the compounding loop.

---

# 32. Suggested Repository Structure

Adapt to existing app.

```text
src/
  app/
    growth/
      page.tsx
      opportunities/
      accounts/
      projects/
      bids/
      proposals/
      ploybooks/
      approvals/
      insights/

  components/
    growth/
    opportunities/
    accounts/
    projects/
    bids/
    proposals/
    approvals/

  lib/
    ai/
      client.ts
      prompts/
      structured-output.ts

    ploybooks/
      engine.ts
      registry.ts
      types.ts

      pb01-gc-pursuit/
      pb02-commercial-development/
      pb03-franchise-expansion/
      pb04-facility-portfolio/
      pb05-opportunity-radar/
      pb06-company-swarm/
      pb07-abm-page/
      pb08-high-intent-visitor/
      pb09-account-research/
      pb10-incoming-bid/
      pb11-bid-analyzer/
      pb12-bid-qa/
      pb13-bid-followup/
      pb14-proposal-deal-room/
      pb15-business-case/
      pb16-programmatic-seo/
      pb17-content-opportunity/
      pb18-growth-operator/

    actions/
      research/
      contacts/
      projects/
      scoring/
      outreach/
      content/
      bids/
      documents/
      monitoring/

    integrations/
      gmail/
      crm/
      quickbooks/
      analytics/
      search-console/
      apollo/
      meta/
      google-ads/
      construction/

    db/
      schema/
      queries/
      mutations/

    evidence/
    scoring/
    documents/
    events/
    audit/

workers/
  ploybook-runner/
  document-processing/
  scheduled-radar/
  monitoring/
```

---

# 33. Engineering Rules for Claude Code

1. Inspect the existing repo before choosing stack or folder structure.
2. Preserve existing HSC branding and components.
3. Do not rewrite working systems unnecessarily.
4. Create migrations before changing schema.
5. Keep external integrations behind interfaces.
6. Use structured schemas for AI output.
7. Validate every AI JSON response.
8. Store source evidence separately from generated summaries.
9. Make long-running actions resumable.
10. Require idempotency on outbound actions.
11. Never send email during local/dev tests.
12. Use fixtures for testing Ploybooks.
13. Build one full real flow before creating abstractions for everything.
14. Avoid premature generic agent frameworks.
15. Prefer explicit state machines over free-form autonomous loops in v1.

---

# 34. Testing Strategy

## Unit

- scoring
- schema validation
- deduplication
- event triggers
- state transitions
- approval resolution
- document classification

## Integration

- Ploybook engine
- email ingestion
- document ingestion
- page generation
- proposal tracking

## Golden Test Cases

Create fixed real HSC examples:

1. Harvey Cleary GC pursuit
2. one commercial development
3. one franchise account
4. one facility portfolio
5. one real historical HSC bid
6. one real proposal
7. one existing SEO page

Each major change should be tested against these.

---

# 35. Seed Data Required

Before build:

- HSC company profile
- services
- differentiators
- W-9
- COI
- UL/certification docs
- warranty docs
- 10–20 strongest project examples
- project images
- current customer list
- current pipeline
- recent won/lost quotes
- recent bid packages
- current proposal template
- known GC targets
- known franchise targets
- current location/service-area list

Do not block engineering on perfect historical data.

Seed enough to make real workflows work.

---

# 36. Recommended First Build Ticket

## Ticket: Growth OS Core + Harvey Golden Path

### Goal

Make one complete real Ploybook work before implementing all 18.

### Build

- account
- contact
- project
- opportunity
- evidence
- Ploybook run
- Ploybook step
- approval
- activity
- AI structured output
- PB01 GC Pursuit
- Harvey Cleary golden test

### Demo

From blank database:

1. Input Harvey Cleary / UH project signal.
2. System creates records.
3. System scores opportunity.
4. System researches account/project.
5. System creates contact roles.
6. System identifies qualification requirements.
7. System drafts outreach.
8. System creates private page draft.
9. System requests approval.
10. User approves/rejects.
11. Activity feed records every action.

Only after this works should PB02–PB18 be layered on.

---

# 37. Product Risk Register

## Risk 1 — Building too much automation before clean data

Mitigation:

- structured entities first
- evidence model
- deduplication
- human review

## Risk 2 — AI makes incorrect bid conclusions

Mitigation:

- page/sheet references
- confidence
- human estimator verification
- never auto-submit

## Risk 3 — Opportunity Radar becomes noisy

Mitigation:

- scoring
- aggressive dedupe
- ignore feedback
- minimum threshold
- "why this matters"

## Risk 4 — Outreach becomes spammy

Mitigation:

- account-level coordination
- Company Swarm timing
- approval
- contact limits
- short HSC messaging rules

## Risk 5 — 18 Ploybooks become disconnected products

Mitigation:

- shared data model
- shared action library
- single Ploybook engine
- single approval inbox
- single activity system

## Risk 6 — September scope overwhelms build

Mitigation:

- Tier A/B/C priority
- define MVP narrowly
- reuse actions
- test each workflow on one real HSC example

---

# 38. Post-September Roadmap

Only after v1 is used.

## October

- stronger email automation
- visitor identification
- proposal engagement scoring
- improved construction sources
- estimate integrations
- automated win/loss intelligence

## November

- predictive opportunity score
- account relationship graph
- contractor-specific performance benchmarks
- capacity-aware pursuit recommendations
- richer franchise/development monitoring

## December+

Potential external product test:

> AI pursuit team for specialty contractors.

Do not externalize until HSC can prove:

- real pipeline sourced
- measurable time savings
- increased bid volume
- higher win rate or revenue
- repeatable workflows beyond signage

---

# 39. Final Product Statement

HSC Growth OS is:

> **An AI-native revenue operating system that finds commercial construction opportunities, decides which ones matter, executes the pursuit workflow, helps HSC bid and follow up, and learns from outcomes.**

It is not:

> a CRM with an AI chatbot.

The long-term advantage is not the generated emails, pages, or summaries.

The advantage is the accumulated proprietary graph of:

- which companies build what
- which people influence which projects
- which HSC capabilities fit which opportunities
- which bids win
- what pricing/margins work
- which relationships matter
- which developments produce repeat work
- which actions lead to revenue

That is the compounding asset.

---

# 40. Claude Code Launch Prompt

Use this as the first instruction when starting implementation:

```text
You are implementing HSC Growth OS v1 using the attached PRD as the source of truth.

First, inspect the existing repository and report:

1. Current application architecture.
2. Current database/auth setup.
3. Existing CRM/lead/proposal functionality.
4. Reusable components and design system.
5. Existing integrations.
6. Anything in the PRD that conflicts with the current architecture.

Then create an implementation plan for Phase 0 and Phase 1 only.

Do not attempt to build all 18 Ploybooks immediately.

The first functional milestone is the "Harvey Golden Path":

signal → account/project/opportunity → score → research → stakeholder map → qualification checklist → outreach draft → account page draft → approval → activity log.

Important constraints:

- preserve existing HSC design and functionality
- use one shared data model
- all AI outputs must be structured and validated
- store source evidence
- require approval before any external communication
- no email may be sent in development
- long-running workflow steps must be resumable
- avoid creating a generic autonomous-agent framework
- prefer explicit workflow/state-machine logic for v1

After inspecting the repo, create the Phase 0 implementation plan and begin with the minimum schema + Ploybook engine required for the Harvey Golden Path.
```

---

# 41. Build Order Summary

```text
CORE
↓
Harvey Golden Path
↓
Opportunity Radar
↓
Account Research
↓
Commercial Development
↓
Franchise Expansion
↓
Facility Portfolio
↓
Company Swarm
↓
ABM Pages
↓
Visitor Intent
↓
Incoming Bid
↓
Bid Analyzer
↓
Bid QA
↓
Bid Follow-Up
↓
Proposal Deal Room
↓
Business Case
↓
Programmatic SEO
↓
Content Builder
↓
Growth Operator
```

Do not change this order casually.

The shared system should get stronger with every Ploybook added.

---

**End of PRD**
