# HSC Growth OS — Build Status

Single source of progress truth. A row closes only when the PB's own PRD §14 acceptance criteria pass as automated tests AND its Definition of Done holds. Phase order per master PRD §26/§41 (sequence, not dates).

## Phase 0 — Core architecture

| Item | Status | Notes |
|---|---|---|
| DB schema (§9 entities) | in progress | |
| Auth (Supabase) | todo | blocked on Supabase account access (ask #1) |
| Core nav + entity screens | todo | |
| Evidence model | in progress | |
| Ploybook / run / step / approval models | in progress | |
| DB-backed job runner | in progress | |
| AI abstraction (LLMClient + envelope) | todo | |
| HSC knowledge base (§17) | todo | needs seed data (ask #2) |
| Activity feed | in progress | |
| Event system (§20) | in progress | |
| **Gate: §26 Phase 0 AC** (dummy PB runs → pauses on approval → resumes → activity logged) | todo | |

## Ploybooks

| PB | Name | Tier | Phase | Status | Fixture | AC tests |
|---|---|---|---|---|---|---|
| PB01 | GC Pursuit | A | 1 | todo | Harvey Cleary / UH | — |
| PB05 | Opportunity Radar | A | 1 | todo | mixed-signal batch | — |
| PB09 | Account Research Brief | B | 1 | todo | Harvey Cleary | — |
| PB02 | Commercial Development Pursuit | B | 2 | todo | real Houston development TBD | — |
| PB03 | Franchise Expansion | B | 2 | todo | OAKBERRY or Wonder (radar §16) | — |
| PB04 | Facility Portfolio Pursuit | B | 2 | todo | HCA CareNow (radar §16) | — |
| PB06 | Company Swarm | B | 3 | todo | strategic account TBD | — |
| PB07 | ABM Account Page | B | 3 | todo | — | — |
| PB08 | High-Intent Visitor | C | 3 | todo | needs RB2B or manual visitor data | — |
| PB10 | Incoming Bid | A | 4 | todo | historical HSC bid pkg (ask #2) | — |
| PB11 | Bid Package Analyzer | A | 4 | todo | same bid pkg; Jamal validates | — |
| PB12 | Bid QA + Submission | C | 4 | todo | — | — |
| PB13 | Bid Follow-Up / Award Watch | A | 5 | todo | — | — |
| PB14 | Proposal Deal Room | A | 5 | todo | real proposal (ask #2) | — |
| PB15 | Business Case / Deal Progression | C | 5 | todo | — | — |
| PB16 | Programmatic Local SEO | C | 6 | todo | existing SEO page | — |
| PB17 | Content Opportunity + Page Builder | C | 6 | todo | GSC gap | — |
| PB18 | Growth Operator | A | 7 | todo | full-system data | — |

## Open asks (Rameel)

1. Supabase account access + GitHub remote (`leadmill-agency/hsc-growth-os` — no `gh` CLI on this machine; create the repo and `git remote add origin`).
2. Seed data per master PRD §35 (W-9, COI, certs, warranty docs, 10–20 project examples, customer list, recent won/lost quotes, one historical bid package, proposal template).
3. PlanHub seat/credentials; confirm whether exports exist.
4. 30 min with Jamal before Phase 4.
5. Sending-domain choice for outbound.
