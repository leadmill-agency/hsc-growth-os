# HSC Growth OS — Build Status

Single source of progress truth. A row closes only when the PB's own PRD §14 acceptance criteria pass as automated tests AND its Definition of Done holds. Phase order per master PRD §26/§41 (sequence, not dates).

## Phase 0 — Core architecture

| Item | Status | Notes |
|---|---|---|
| DB schema (§9 entities) | **done** | drizzle migration 0000; Supabase PG in prod, PGlite local |
| Auth | **done 2026-09-09** (team-password gate + HMAC session; per-user Supabase auth is the later upgrade when roles matter) | |
| Database (Supabase) | **done 2026-09-09** | project `somkkvfrrxjcsdngdpaw` (us-west-2); migrations applied; local dev + prod share it |
| Hosting (Railway) | **DEPLOYED 2026-09-09** | https://hsc-growth-os-production.up.railway.app — GitHub-linked (auto-deploys main), env vars set; TDLR cron service still todo |
| Core nav + entity screens | **done** (minimal) | home/accounts/opportunities/ploybooks/runs/approvals; polish in Phase 1 |
| Evidence model | **done** | `evidence` table + `saveEvidence` action |
| Ploybook / run / step / approval models | **done** | |
| DB-backed job runner | **done** | resumable, idempotent, retry; `src/lib/ploybooks/runner.ts` |
| AI abstraction (LLMClient + envelope) | **done** | `messages.parse` + zod; FixtureLLMClient for tests; live call untested until API key present |
| Guarded outbound send layer | **done** | refuses without ALLOW_EXTERNAL_SEND + approved approval; idempotent |
| HSC knowledge base (§17) | todo | table exists (`knowledge_entries`); needs seed data (ask #2) |
| Activity feed | **done** | per-entity + per-run, actor-attributed |
| Event system (§20) | **done** | emit + table; trigger subscriptions come with PB05 |
| **Gate: §26 Phase 0 AC** (dummy PB runs → pauses on approval → resumes → activity logged) | **PASSED 2026-09-06** | 7 vitest tests green + verified live in UI (PB00: launch → pause → approve → complete, full activity trail) |

## Ploybooks

| PB | Name | Tier | Phase | Status | Fixture | AC tests |
|---|---|---|---|---|---|---|
| PB01 | GC Pursuit | A | 1 | **MVP done 2026-09-07** | Harvey Cleary / UH | golden-path suite green + LIVE run verified (real OpenAI research → real contacts → 88-word draft → approval → completed). Outreach send stays draft-only until sending domain + adapter exist. |
| PB05 | Opportunity Radar | A | 1 | **MVP done 2026-09-07** + **TDLR feed live** | Harvey signal + real TABS filing | parse→dedupe→score→suggest verified live; `npm run radar:tdlr` pulls Greater-Houston TABS filings (public JSON endpoint, county/city code tables vendored); no-company permit signals anchor on the project with account null ("identify owner/GC" next action). CoH + PlanHub ingestion still todo |
| PB09 | Account Research Brief | B | 1 | **MVP done 2026-09-07** | Harvey Cleary | shared action + standalone ploybook; evidence writebacks |
| PB02 | Commercial Development Pursuit | B | 2 | **MVP done 2026-09-07** | Manvel Town Center | players+tenants→linked records; revenue estimate stored as ASSUMPTION evidence; developer-anchored recommendation |
| PB03 | Franchise Expansion | B | 2 | **MVP done 2026-09-07** | OAKBERRY | brand→strategic score→child location opps (evidence-backed only)→buying-path motion |
| PB04 | Facility Portfolio Pursuit | B | 2 | **MVP done 2026-09-07** | HCA CareNow | operator→properties+contacts→strategic score→incumbent-aware portfolio motion |
| PB06 | Company Swarm | B | 3 | **MVP done 2026-09-07** | 4-contact GC fixture | plan→distinct drafts (similarity-validated in code, fails visibly on dupes)→ONE swarm approval |
| PB07 | ABM Account Page | B | 3 | **MVP done 2026-09-07** | Harvey Cleary (live) | private noindex page at /p/[token], publish behind approval, per-view tracking (interaction + event); proof points placeholder until real portfolio seeded; verified live |
| PB08 | High-Intent Visitor | C | 3 | **MVP done 2026-09-07** | deterministic page-intent fixture | /api/visitor intake (token-guarded) ready for RB2B webhook; RB2B script installed on website repo (commit 40c5e2e, needs push+deploy) |
| PB10 | Incoming Bid | A | 4 | **MVP done 2026-09-09** | real RTG/C.A. Walker invite | parse→tracked bid w/ internal due buffer→BID/REVIEW/PASS gate→assigns Jamal→queues PB11 |
| PB11 | Bid Package Analyzer | A | 4 | **MVP done 2026-09-09 — LIVE-verified on real RTG package** | RTG Baytown (190 docs) + Saratoga (Planhub folder w/ HSC's own takeoff = answer key, ungraded yet) | ingestion (§19: originals untouched, quality-flagged), relevance selection matched human sheet-pull, scope split in-house vs supplier-fab, day-1 supplier RFQs behind approval (Jamal's #1 bottleneck). **Awaiting Jamal's grading of docs/demos/2026-09-09-rtg-estimator-brief.md** |
| PB12 | Bid QA + Submission | C | 4 | **MVP done 2026-09-09** | seeded bid | deterministic checklist incl. supplier quotes + computed deadline check; READY/NOT READY; human submits; bid.submitted event feeds PB13 |
| PB13 | Bid Follow-Up / Award Watch | A | 5 | todo | — | — |
| PB14 | Proposal Deal Room | A | 5 | todo | real proposal (ask #2) | — |
| PB15 | Business Case / Deal Progression | C | 5 | todo | — | — |
| PB16 | Programmatic Local SEO | C | 6 | todo | existing SEO page | — |
| PB17 | Content Opportunity + Page Builder | C | 6 | todo | GSC gap | — |
| PB18 | Growth Operator | A | 7 | todo | full-system data | — |
| PB21 | Creative Intelligence (genome schema first) | ext | 8 | todo | 50-experiment seed library | — |
| PB19 | Social Content Engine | ext | 8 | todo | one real HSC project asset set | — |
| PB20 | Social Engagement & Referral Engine | ext | 8 | todo | IG comment → opportunity path | — |
| PB21 | Creative Intelligence (analytics loop) | ext | 8 | todo | PB19 experiment outcomes | — |

## Open asks (Rameel)

1. Supabase account access + GitHub remote (`leadmill-agency/hsc-growth-os` — no `gh` CLI on this machine; create the repo and `git remote add origin`).
2. Seed data per master PRD §35 (W-9, COI, certs, warranty docs, 10–20 project examples, customer list, recent won/lost quotes, one historical bid package, proposal template).
3. PlanHub seat/credentials; confirm whether exports exist.
4. 30 min with Jamal before Phase 4.
5. Sending-domain choice for outbound.
