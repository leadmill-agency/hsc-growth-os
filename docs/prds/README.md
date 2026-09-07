# HSC Growth OS — Ploybook PRDs

This directory contains the standalone implementation PRDs for PB01–PB18.

The master PRD (`hsc_growth_os_v1_prd.md`) and this pack are the plan of record — full 18-PB scope, phases per master PRD §26/§41. See [ADDENDUM-2026-09-06.md](ADDENDUM-2026-09-06.md) for the 2026-09-06 decision log (repo/stack choices, signal sources, tooling, team). [hsc_expansion_radar_prd.md](hsc_expansion_radar_prd.md) is an input document: signal sources, scoring heuristics, and seed/fixture accounts for PB03/PB04/PB05 — not a scope change.

## Build order

### Foundation / shared
- PB09 — Account Research Brief
- PB05 — Opportunity Radar

### Find + pursue
- PB01 — GC Pursuit
- PB02 — Commercial Development Pursuit
- PB03 — Franchise Expansion
- PB04 — Facility Portfolio Pursuit
- PB06 — Company Swarm
- PB07 — ABM Account Page
- PB08 — High-Intent Visitor

### Win
- PB10 — Incoming Bid
- PB11 — Bid Package Analyzer
- PB12 — Bid QA + Submission
- PB13 — Bid Follow-Up / Award Watch
- PB14 — Proposal Deal Room
- PB15 — Business Case / Deal Progression

### Grow + learn
- PB16 — Programmatic Local SEO
- PB17 — Content Opportunity + Page Builder
- PB18 — Growth Operator

### Social extension (added 2026-09-07, `social_extension/`)
- PB19 — Social Content Engine (create → review → post → measure loop; ViralBench-derived, commercial reward function)
- PB20 — Social Engagement & Referral Engine (comments/inbound → qualification → reply → CRM; NO cold-DM-from-likes — official-API constraint)
- PB21 — Creative Intelligence Engine (content genome + organic/paid learning loop)
- Supporting: `viralbench_architecture_to_pb19.md` (architecture teardown), `hsc_social_content_genome_50_experiments.md` (seed experiment library)
- Internal build order per `social_extension/SOCIAL_EXTENSION_README.md`: PB21 genome schema → PB19 golden path → PB20 golden path → PB21 analytics

## Files
- [PB01 — GC Pursuit](pb01_gc_pursuit_prd.md)
- [PB02 — Commercial Development Pursuit](pb02_commercial_development_pursuit_prd.md)
- [PB03 — Franchise Expansion](pb03_franchise_expansion_prd.md)
- [PB04 — Facility Portfolio Pursuit](pb04_facility_portfolio_pursuit_prd.md)
- [PB05 — Opportunity Radar](pb05_opportunity_radar_prd.md)
- [PB06 — Company Swarm](pb06_company_swarm_prd.md)
- [PB07 — ABM Account Page](pb07_abm_account_page_prd.md)
- [PB08 — High-Intent Visitor](pb08_high_intent_visitor_prd.md)
- [PB09 — Account Research Brief](pb09_account_research_brief_prd.md)
- [PB10 — Incoming Bid](pb10_incoming_bid_prd.md)
- [PB11 — Bid Package Analyzer](pb11_bid_package_analyzer_prd.md)
- [PB12 — Bid QA + Submission](pb12_bid_qa_submission_prd.md)
- [PB13 — Bid Follow-Up / Award Watch](pb13_bid_follow_up_award_watch_prd.md)
- [PB14 — Proposal Deal Room](pb14_proposal_deal_room_prd.md)
- [PB15 — Business Case / Deal Progression](pb15_business_case_deal_progression_prd.md)
- [PB16 — Programmatic Local SEO](pb16_programmatic_local_seo_prd.md)
- [PB17 — Content Opportunity + Page Builder](pb17_content_opportunity_page_builder_prd.md)
- [PB18 — Growth Operator](pb18_growth_operator_prd.md)

## Critical architecture rule

These are separate PRDs for implementation clarity, **not separate applications**. They must share the HSC Growth OS entity graph, Ploybook runner, approvals, evidence model, action library, and event system from the master PRD.
