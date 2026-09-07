# PRD: HSC Expansion Radar — Multi-Location Rollout Prospecting OS

**Owner:** Houston Sign Crafters (HSC)  
**Primary user:** Rameel Sheikh / HSC sales & marketing  
**Status:** Draft v1  
**Build environment:** Claude Code  
**Primary market:** Texas, with Houston priority  
**Primary objective:** Automatically discover, score, research, and prepare outreach for multi-location operators that are opening, acquiring, rebranding, remodeling, or rolling out 5+ Texas locations where signage spend is likely to be meaningful.

---

## 1. Executive Summary

HSC currently finds high-value expansion opportunities manually by searching public filings, company announcements, franchise development news, local construction data, and LinkedIn/Apollo contacts.

The manual workflow works, but it is slow and inconsistent.

The best opportunities have a repeatable pattern:

1. A multi-site operator announces or begins a Texas rollout.
2. Public records reveal exact project addresses, construction timing, architects, owners, tenants, and sometimes permit scope.
3. HSC determines whether signage appears centrally procured, locally procured, or already locked to an incumbent.
4. HSC identifies the right people inside construction, development, procurement, supply chain, facilities, real estate, or the franchise/operator entity.
5. HSC does real pre-work before reaching out: maps sites, reviews sign codes, identifies likely signage packages, researches landlord requirements, and checks incumbent vendors.
6. HSC sends a short cold email showing the work has already been done and asking to send the brief / bid upcoming projects.

This product should automate as much of that workflow as possible.

The system is not a generic lead scraper. It should behave like a highly focused analyst working specifically for a commercial sign company.

---

## 2. Product Thesis

HSC should not compete for one-off $5k sign jobs if it can identify operators with 5–100+ planned locations and become part of their rollout vendor network.

The best target is not simply "a company opening stores."

The best target is:

> **A reachable operator with multiple Texas openings, meaningful signage scope, live construction activity, no obvious locked national sign vendor, and a clear path to a construction/procurement decision-maker.**

The software should continuously answer:

> **Who is about to spend money on signage in Texas, how much might they spend, who controls the decision, and what useful work can HSC do before asking for the business?**

---

## 3. Goals

### 3.1 Primary goals

- Discover new Texas multi-location expansion opportunities before competitors do.
- Prioritize restaurant, retail, fitness, car wash, healthcare, hospitality, and other multi-site operators.
- Identify operators opening, acquiring, rebranding, or remodeling **5+ Texas locations**.
- Detect live projects in Greater Houston and Texas using construction/permitting data.
- Estimate signage spend potential.
- Identify incumbent sign vendors where possible.
- Identify the most relevant people to contact.
- Generate a concise, evidence-backed account brief.
- Generate short cold emails that show HSC has already done the work.
- Track outreach, responses, referrals, bids, and wins.
- Avoid resurfacing old leads unless there is a meaningful new development.

### 3.2 Secondary goals

- Build a proprietary database of Texas expansion activity.
- Build a historical map of which architects, GCs, franchise groups, developers, and sign vendors repeatedly appear together.
- Learn which signals predict actual sign bids.
- Learn which contact titles most often lead to a response.
- Learn which account archetypes HSC wins most often.

---

## 4. Non-Goals

The first version should **not**:

- Be a generic CRM replacement.
- Send cold emails automatically without human review.
- Auto-purchase Apollo/Clay credits without approval.
- Scrape LinkedIn in violation of platform terms.
- Assume every company with a development announcement is a good lead.
- Fabricate missing construction addresses, emails, project details, or incumbent vendors.
- Generate long enterprise sales emails.
- Optimize for thousands of low-quality leads.

The system should prefer **10 excellent accounts over 1,000 weak ones**.

---

# 5. Core Workflow

## Stage 1 — Opportunity Discovery

Continuously search for evidence of:

- New store development agreements.
- Franchise development agreements.
- Multi-unit commitments.
- Corporate store expansion.
- Texas market entry.
- Houston market entry.
- Acquisitions with rebranding implications.
- Brand conversions.
- Remodel programs.
- New hospital / urgent care / clinic rollouts.
- Hotel portfolio rebrands.
- Fitness expansion.
- Car wash acquisitions / conversions.
- Retail rollouts.
- Ground-up construction programs.
- Tenant improvement programs.

### Preferred sources

1. Texas Department of Licensing and Regulation (TDLR/TABS)
2. City / county permit portals
3. Company press releases
4. PR Newswire / GlobeNewswire
5. Franchise Times / Franchising.com / QSR / Restaurant Business
6. Houston Business Journal / Dallas Business Journal / Austin Business Journal / San Antonio Business Journal
7. Local newspapers
8. Company LinkedIn posts
9. Developer / landlord leasing pages
10. GC project portfolios
11. Architect project pages
12. Company careers pages
13. SEC filings / FDDs where applicable
14. Google search results
15. Apollo / Clay for contact enrichment only after account qualification

### Search themes

Examples:

- `"opening" AND Texas AND locations`
- `"development agreement" AND Texas AND franchise`
- `"Houston" AND "new locations" AND restaurant`
- `"Texas expansion" AND retail`
- `site:tdlr.texas.gov brand name`
- `"rebrand" AND Texas clinics`
- `"acquired" AND Texas locations`
- `"plans to open" AND Texas AND stores`

### Discovery cadence

- Daily: recent announcements / live projects
- Weekly: broader search for new multi-unit commitments
- Monthly: refresh all active accounts for new projects

---

# 6. Opportunity Qualification

Each account receives a score from 0–100.

## 6.1 Scoring model

### A. Signage spend potential — 0–25

Factors:

- Number of planned locations
- Typical store size
- Exterior signage complexity
- Monument / pylon likelihood
- Interior / environmental graphics opportunity
- Rebrand scope
- Ground-up vs inline retail
- Number of elevations
- Custom architectural / neon / wayfinding needs

Example heuristic:

| Signal | Score impact |
|---|---:|
| 5–9 locations | +5 |
| 10–24 locations | +10 |
| 25–49 locations | +15 |
| 50+ locations | +20 |
| Ground-up / destination format | +3 |
| Multi-sign / monument / wayfinding likely | +2 |

### B. Winability — 0–20

Factors:

- Local franchisee / operator identifiable
- Procurement appears decentralized
- Existing national vendor absent or unclear
- HSC self-perform radius overlaps project cluster
- Operator is small enough to reach directly
- Sign package not yet awarded

Penalties:

- Strong incumbent proven: -5 to -10
- National program with exclusive supplier: -10
- Project already opened: -5
- Rebrand appears fully complete: -10

### C. Geographic fit — 0–15

- Greater Houston: 15
- Houston + other Texas metros: 12
- DFW / Austin / San Antonio only: 8
- Texas statewide with Houston included: 12
- Texas statewide without Houston evidence: 7

### D. Timing — 0–15

- Construction / signage decision happening now: 15
- Construction starts in 0–90 days: 13
- Site signed but construction 3–6 months out: 10
- Development agreement only: 6
- Opened / already completed: 2

### E. Buyer reachability — 0–15

- Named owner / franchisee with public contact: 15
- Director-level construction/development contact identified: 13
- Procurement contact identified: 12
- Only senior corporate executives identified: 7
- No clear buyer: 2

### F. Strategic repeat value — 0–10

- 50+ location program: 10
- 20–49: 8
- 10–19: 6
- 5–9: 4
- One-off project: 0

### Priority bands

- **85–100: Attack now**
- **70–84: Research + outreach this week**
- **55–69: Monitor / nurture**
- **Below 55: Ignore unless new development occurs**

---

# 7. Opportunity Record Schema

Each account should store:

```yaml
account:
  id: string
  company_name: string
  operator_name: string | null
  parent_company: string | null
  category: restaurant | retail | fitness | car_wash | healthcare | hospitality | other
  website: string
  hq_location: string | null
  texas_rollout_size: integer | null
  houston_rollout_size: integer | null
  rollout_description: string
  expansion_type: new_build | franchise | acquisition | rebrand | remodel | conversion
  announcement_date: date | null
  first_seen_at: datetime
  last_updated_at: datetime
  opportunity_score: integer
  priority_band: string
  estimated_signage_spend_low: number | null
  estimated_signage_spend_high: number | null
  incumbent_status: unknown | likely | confirmed
  incumbent_vendor: string | null
  incumbent_evidence: string | null
  procurement_model: central | franchisee | gc | regional | unknown
  notes: text
```

---

# 8. Project / Site Schema

```yaml
project:
  id: string
  account_id: string
  location_name: string
  address: string | null
  city: string
  state: string
  zip: string | null
  project_status: announced | site_selection | lease_signed | permit | construction | signage_permit | open
  construction_start: date | null
  construction_end: date | null
  square_feet: number | null
  construction_budget: number | null
  architect: string | null
  general_contractor: string | null
  landlord: string | null
  owner: string | null
  tenant: string | null
  jurisdiction: string | null
  permit_url: string | null
  signage_separate_permit: boolean | null
  landlord_sign_criteria_found: boolean
  estimated_sign_scope: text
  estimated_sign_spend_low: number | null
  estimated_sign_spend_high: number | null
  evidence_urls: string[]
```

---

# 9. Contact Discovery Workflow

Do not search Apollo/Clay broadly until the account is qualified.

## 9.1 Contact role hierarchy

### Tier 1 — Best contacts

- Director / VP of Construction
- Director of Design & Construction
- Store Development Director
- Development Project Manager
- Pre-Construction Project Manager
- Procurement Director
- Head of Procurement
- Strategic Sourcing Director
- Supply Chain / Sourcing lead tied to store openings

### Tier 2 — Strong routing / influence contacts

- Director of Development
- Real Estate Development Manager
- Real Estate Strategy
- Facilities Director
- VP Strategic Growth
- Brand Development / Store Experience
- Franchisee / multi-unit operator

### Tier 3 — Use only if Tier 1/2 unavailable

- President / COO / Founder
- EVP Operations
- Real Estate acquisitions
- General facilities personnel

### Usually avoid

- Legal
- General counsel
- Restaurant/store GMs
- Area managers
- HR
- Finance-only roles
- Marketing-only roles unless rebrand / brand compliance is central

---

# 10. Contact Schema

```yaml
contact:
  id: string
  account_id: string
  first_name: string
  last_name: string
  title: string
  company: string
  department: string | null
  seniority: string | null
  location: string | null
  linkedin_url: string | null
  work_email: string | null
  email_status: verified | inferred | unknown
  phone: string | null
  apollo_url: string | null
  clay_record_id: string | null
  role_score: integer
  contact_priority: 1 | 2 | 3
  personalization_fact: string | null
  why_relevant: string
  source_urls: string[]
```

---

# 11. Proof-of-Work Research Workflow

Before outreach, the system should create a short account brief.

The brief is the core differentiation.

HSC should never send:

> "We are a sign company. Can we quote your next project?"

Instead:

> "We saw your rollout, studied the projects, and already mapped how we would support it."

## 11.1 Research checklist

For each account, answer:

1. What exactly is being built / acquired / rebranded?
2. How many Texas locations?
3. How many Houston locations?
4. Which exact addresses are known?
5. Which are live right now?
6. What is the estimated construction timeline?
7. What signage scope appears likely?
8. Is signage called out under a separate permit?
9. Who is the architect?
10. Who is the GC?
11. Who is the landlord / developer?
12. What municipal sign code applies?
13. Is there a PUD / landlord sign criteria overlay?
14. Who appears to be the incumbent sign vendor?
15. Is signage centrally sourced, locally sourced, or unknown?
16. Which HSC capabilities are most relevant?
17. What is the best non-generic reason to contact this person?

---

# 12. Incumbent Vendor Detection

This step is mandatory for high-value accounts.

## Search methods

- Search brand name + "sign company"
- Search brand name + "channel letters"
- Search brand name + "sign permit"
- Search portfolio pages of local/national sign companies
- Search GC project pages
- Search city permit data
- Search LinkedIn posts from fabricators/installers
- Search architect / construction photos
- Search BuildZoom / permit aggregators

## Incumbent status

### Unknown
No evidence found.

### Likely
Multiple circumstantial signals but no direct proof.

### Confirmed
A sign company publicly lists the brand/project or appears in permit records.

## Outreach behavior based on incumbent

### Unknown
Ask directly for opportunity to bid.

### Likely
Say:

> "I realize you likely already have existing sign partners. We'd love to be another Texas resource and bid projects as they come up."

### Confirmed
Do not ask them to replace the vendor.

Position HSC as:

- overflow capacity
- local permitting resource
- Houston self-perform partner
- competitive bid option
- service / repair vendor
- regional installation partner
- Texas rollout support

---

# 13. Standard Account Brief Output

Each researched account should produce a concise Markdown brief.

Suggested format:

```markdown
# [Company] — Texas Signage Opportunity

## Opportunity
- Texas rollout: X locations
- Houston: X locations
- Timing: ...
- Estimated signage spend: $X–$Y
- Opportunity score: 87/100

## Live Projects
| Site | Address | Status | Timing | Likely sign scope |
|---|---|---|---|---|

## Why HSC Can Win
- ...
- ...

## Incumbent
- Status: Unknown / Likely / Confirmed
- Vendor: ...
- Evidence: ...

## Best Contacts
| Name | Title | Priority | Why |
|---|---|---:|---|

## Recommended Offer
...

## Recommended Outreach Angle
...

## Sources
- ...
```

---

# 14. Outreach Generation

## 14.1 House style

Cold emails must be:

- **100–150 words max**
- short paragraphs
- direct
- no jargon
- no fake flattery
- no long company history
- no "I hope this email finds you well"
- no long explanations of HSC capabilities
- no generic request to "earn your business"

## 14.2 Preferred structure

### Paragraph 1 — Who + why

> I run Houston Sign Crafters, a UL-listed sign manufacturer based in Houston. I reached out because [specific rollout / project trigger].

### Paragraph 2 — Capabilities

> We handle surveys, landlord coordination, permitting, UL fabrication, electrical work and installation across Texas.

### Paragraph 3 — Proof of work

> Before reaching out, we reviewed [specific projects / existing stores / permits / sign system] and put together a short breakdown of [useful work].

### Paragraph 4 — Low-friction CTA

> Would it be useful if I sent that over? We'd love the opportunity to bid projects as they come up.

## 14.3 Incumbent-aware variant

If incumbent exists:

> I realize you likely already have existing sign partners. I'm not looking to disrupt that — we'd simply like the opportunity to bid upcoming Texas projects and be another local resource as the rollout grows.

---

# 15. Recommended Offers by Account Type

The offer should be **pre-work**, not a discount.

Do not lead with:

- free signs
- first store at cost
- discounting
- "give us one store to prove ourselves"

## 15.1 Franchise / local operator

Offer:

> Send us the next site address + landlord criteria. We'll review the sign package, permit requirements, install conditions, and preliminary budget before you commit to us.

## 15.2 Corporate rollout

Offer:

> Give us the first 2–3 Texas locations. We'll map permitting, landlord requirements, signage scope, installation conditions, and preliminary budgets so you can evaluate us before awarding work.

## 15.3 Rebrand / healthcare

Offer:

> We can support local Houston surveys, permitting, fabrication, installation, punch, service, and overflow even if the core brand program is centrally sourced.

## 15.4 Strong incumbent

Offer:

> Add HSC as a secondary Texas resource for overflow, local permitting, service, or competitive bids.

---

# 16. Example Seed Opportunities

These should be preloaded as test accounts.

## 16.1 HCA Houston / HCA CareNow

**Type:** Healthcare / acquisition / rebrand / ongoing expansion  
**Why it matters:** HCA acquired 40 Texas MedClinic locations, including 8 Houston clinics, and converted them to HCA CareNow branding. Houston's CareNow footprint is now materially larger and HCA continues to expand outpatient care.  
**Pitch:** Do not focus only on the completed rebrand. Pitch HSC as a Houston-area signage resource for future CareNow openings, rebrands, outpatient projects, service, permitting, and overflow.  
**Potential titles:**
- VP Strategic Growth
- Director of Design & Construction
- Director of Ambulatory Development
- Facilities Director
- Construction Project Manager
- Procurement / Strategic Sourcing

**Known relevant people from research:**
- Tyler Laymon — VP, Strategic Growth
- Jaime Izaguirre — Facilities Director, HCA Houston Healthcare

**Recommended pre-work:**
- Map the 8 acquired Houston clinics
- Identify which have completed rebranding
- Compare legacy CareNow vs HCA CareNow signage
- Search HCA Houston construction pipeline
- Identify national / incumbent sign vendors

---

## 16.2 Wonder

**Type:** Corporate rollout  
**Texas scale:** 100+ planned locations by end of 2027  
**Houston evidence:** Multiple live projects, including Dennis St., Yale St., and Spring Stuebner.  
**Key trigger:** Dennis and Yale filings call signage out under separate permits.  
**Known relevant contacts:**
- Jegar Keeney — Director of Design and Construction
- Johnathan Davila — Director of Construction
- Luis Rodriguez — Project Manager, Pre-Construction
- Rachel Gibney — Procurement Director
- Jennifer Snyder — Head of Procurement
- Kaelyn Tomaszewski — VP Procurement & Sourcing
- Ryan Schraier — Real Estate Development Manager

**Pitch:** Wonder already has a mature rollout machine. HSC should not propose creating their system. HSC should propose executing the existing system locally in Texas.

---

## 16.3 OAKBERRY / Rand Group International

**Type:** Statewide franchise / operator rollout  
**Texas scale:** Nearly 100 planned stores  
**Key insight:** OAKBERRY requires approved/designated suppliers but provides a supplier approval process.  
**Known contacts:**
- Adrian Maizey — Rand Group International, economic buyer / Texas operator
- Alejandro Jorrín — Supply Chain Manager, OAKBERRY USA
- Claudia Goncalves — Brand Development / Customer Experience, OAKBERRY USA

**Pitch:** HSC becomes an approved Texas signage supplier capable of executing standardized inline, endcap, urban, and kiosk packages.

**Proof-of-work already defined:**
- Reverse engineer existing U.S. OAKBERRY stores
- Standardize four signage package types
- Offer to map first 2–3 Texas locations before award

---

## 16.4 Biddy Restaurant Group / Potbelly

**Type:** Local franchise rollout  
**Texas/Houston scale:** 10 Houston-area stores  
**Known sites:** Missouri City opened; Manvel Town Center under construction  
**Known principals:** Dana Biddy / Richard Biddy  
**Pitch:** Get Manvel right, then standardize signage execution across stores #3–10.  
**Pre-work:**
- City of Manvel sign requirements
- Manvel Town Center PUD signage overlay
- Weitzman landlord criteria
- DXU architecture
- incumbent vendor check

---

## 16.5 Waffle House — Montgomery County

**Type:** Corporate rollout  
**Known Houston-area projects:** New Caney, Conroe, Porter, Kingwood, Splendora  
**Key insight:** Development appears centrally controlled. Bakers Signs appears to be an incumbent / existing vendor.  
**Known contacts:**
- Austin Stiewert — Construction Superintendent
- Steven Haught — VP Supply Chain & Purchasing
- Brian Redd — VP / Construction Manager
- Stephen Hinnerichs — Director of Permitting
- Jeff Wright — VP Real Estate & Permitting
- Erin Cleland — recurring owner/development contact

**Pitch:** Do not ask to replace incumbent. Offer local permitting, install, service, overflow, or secondary Texas vendor support.

---

## 16.6 Kirby Ice House

**Type:** Houston-based expansion / custom destination hospitality  
**Known expansion:** Plano + Irving projects, with broader growth plan  
**Known relevant contacts:**
- Chad Holcomb-Love — Construction Manager
- Garrett Grassau — Director of Development
- Russ Morgan — President
- Michael Johnson — COO

**Incumbent:** Visual FX Signs has confirmed historical Kirby work.  
**Pitch:** Do not ask to replace Visual FX. Ask to bid DFW work / be additional statewide capacity.

---

# 17. Dashboard Requirements

## 17.1 Main table

Columns:

- Company
- Operator
- Category
- Texas locations planned
- Houston locations planned
- Live project count
- Opportunity score
- Estimated signage spend
- Timing
- Incumbent status
- Best contact
- Outreach status
- Last update
- Next action

Filters:

- Category
- Score
- Houston-only
- Live construction
- No incumbent
- Contact found
- Not contacted
- Replied
- Bid opportunity

---

# 18. Account Detail Page

Tabs / sections:

1. Overview
2. Projects
3. Contacts
4. Research brief
5. Incumbent vendors
6. Outreach
7. Activity log
8. Sources

### Actions

- Refresh research
- Find new projects
- Re-score opportunity
- Generate contact search suggestions
- Mark contact email found
- Generate email
- Copy email
- Mark sent
- Record reply
- Create follow-up task
- Export brief to Markdown/PDF

---

# 19. Dedupe / New Development Logic

The system must avoid resurfacing accounts repeatedly unless something changed.

## Meaningful new development triggers

- New location announced
- New TDLR project filed
- Permit moves to construction
- Sign permit appears
- New acquisition
- Rebrand announced
- New market entered
- New franchise agreement
- New operator / franchisee identified
- New incumbent vendor evidence
- New contact identified
- Existing project changes status

If none of the above occurs, do not show the account as "new" again.

---

# 20. Research Agent Architecture

Suggested agents/modules:

## Agent 1 — Expansion Scout

Finds new accounts and announcements.

Output:

```json
{
  "company": "...",
  "why_new": "...",
  "texas_scale": 0,
  "houston_scale": 0,
  "source_urls": []
}
```

## Agent 2 — Project Mapper

Searches TDLR and permit records for exact projects.

## Agent 3 — Signage Analyst

Estimates signage package and spend.

## Agent 4 — Incumbent Investigator

Looks for existing sign vendors.

## Agent 5 — Contact Strategist

Suggests exact titles / named people to search in Apollo or Clay.

## Agent 6 — Proof-of-Work Brief Writer

Creates the account brief.

## Agent 7 — Outreach Writer

Creates 100–150 word emails based on role + evidence.

## Agent 8 — Opportunity Scorer

Applies deterministic scoring model.

---

# 21. Human-in-the-Loop Rules

The system should not send outbound automatically in v1.

Require human approval before:

- Sending email
- Adding an unverified personal email
- Marking an incumbent as confirmed
- Claiming a project is unawarded
- Estimating signage spend above a defined threshold
- Uploading/exporting customer-facing briefs

Human inputs that should be easy:

- Paste Apollo contact result
- Mark email as verified
- Add known relationship / referral
- Override score
- Mark incumbent known
- Mark "do not contact"

---

# 22. Data Quality Rules

Every material claim needs a source URL.

Do not store a factual claim without:

- source URL
- date accessed
- source type
- confidence level

Confidence:

- **High:** government filing, company press release, company website
- **Medium:** reputable trade publication, LinkedIn from company employee
- **Low:** aggregator, scraped profile, unverified directory

Do not present low-confidence facts as certain.

---

# 23. Suggested Tech Stack

Claude Code can choose implementation details, but a practical v1:

### Frontend
- Next.js
- TypeScript
- Tailwind
- shadcn/ui

### Backend
- Next.js server actions / API routes or lightweight FastAPI service
- Postgres / Supabase

### Search / ingestion
- Search API of choice
- HTML fetch + parser
- TDLR query automation where legally/technically feasible
- Optional Firecrawl / Browserless for structured extraction

### LLM
- Claude for extraction, classification, synthesis, and drafting

### Contact enrichment
- Apollo API if available
- Clay via API/webhook if available
- Manual paste as fallback

### CRM integration
- Optional later: HubSpot / GoHighLevel / Slack / Airtable

---

# 24. Slack Integration (Recommended)

Create a channel:

`#expansion-radar`

Daily alert example:

> **NEW HIGH-PRIORITY LEAD — Wonder (92/100)**  
> 3 live Houston projects + 100+ Texas rollout. Dennis/Yale call signage under separate permits.  
> Best contacts: Director of Design & Construction, Director of Construction, Procurement Director.  
> Incumbent: Unknown.  
> Estimated Texas signage opportunity: $700k–$1.2M.  
> [Open account]

Weekly digest:

- New accounts discovered
- Accounts with new construction filings
- Accounts ready for outreach
- Contacts missing emails
- Follow-ups due
- Bids created
- Wins / losses

---

# 25. Outreach Tracking

Statuses:

1. Researching
2. Contact search
3. Ready to email
4. Sent
5. Follow-up due
6. Replied
7. Referred internally
8. Meeting booked
9. Bid requested
10. Bid submitted
11. Won
12. Lost
13. Monitor
14. Do not contact

Store:

- Date sent
- Contact
- Subject
- Email body
- Reply
- Internal referral
- Next step
- Bid value
- Revenue won

---

# 26. Learning Loop

Track performance by:

- Opportunity score band
- Industry
- Contact title
- Expansion type
- Number of locations
- Houston vs non-Houston
- Incumbent status
- Email variant
- Offer type

KPIs:

- Leads discovered / week
- High-priority leads / week
- % with exact project addresses
- % with decision-maker identified
- % with verified email
- Reply rate
- Internal referral rate
- Bid-request rate
- Bid win rate
- Revenue won
- Expected lifetime account value

After enough data, update scoring weights based on actual HSC wins.

---

# 27. V1 User Flow

1. System runs daily searches.
2. New account enters "Unreviewed."
3. Expansion Scout extracts rollout details.
4. Project Mapper finds Texas / Houston projects.
5. Opportunity Scorer calculates score.
6. Accounts >70 enter "Research Queue."
7. Incumbent Investigator runs.
8. Contact Strategist recommends exact people/titles.
9. User finds/enriches emails via Apollo/Clay.
10. User pastes or syncs contacts back into system.
11. Proof-of-Work Brief generated.
12. Outreach Writer drafts role-specific email.
13. User reviews and sends.
14. System tracks response and follow-up.
15. New project filings automatically re-open dormant accounts.

---

# 28. MVP Scope

## Must have

- Account database
- Project database
- Source tracking
- Discovery queue
- TDLR project research
- Scoring engine
- Contact recommendation
- Apollo/Clay manual enrichment workflow
- Incumbent vendor research
- Markdown brief generation
- Cold email generation
- Outreach status tracking
- Dedupe / meaningful update detection

## Nice to have

- Slack alerts
- Apollo API integration
- Clay integration
- Maps
- Permit jurisdiction library
- Landlord criteria library
- Automatic follow-up drafts
- Gmail integration

## Later

- Automated CRM sync
- Automatically generated PDF briefs
- AI-generated site mockups
- Proposal generation
- Quote generation
- Bid tracking / win prediction
- Nationwide expansion beyond Texas

---

# 29. Acceptance Criteria

The MVP is successful when it can:

1. Discover a new multi-location Texas expansion without manual input.
2. Identify at least one reliable source proving the expansion.
3. Find known Texas projects when public filings exist.
4. Score the opportunity consistently.
5. Identify the correct contact title hierarchy.
6. Produce a useful Apollo/Clay search plan.
7. Detect at least obvious incumbent vendors.
8. Produce a one-page account brief with sourced facts.
9. Produce a cold email under 150 words matching HSC style.
10. Avoid resurfacing the same lead as new without a meaningful update.
11. Track whether outreach converted to a reply, bid, or win.

---

# 30. Example Final Output

```markdown
# Wonder — Texas Expansion Opportunity

**Score:** 92/100  
**Priority:** Attack now  
**Texas rollout:** 100+ locations  
**Houston live projects:** 3  
**Incumbent:** Unknown  
**Estimated account signage value:** $700k–$1.2M

## Why now
- Dennis St. and Yale St. are in active construction.
- Both filings call signage out under separate permits.
- Spring Stuebner is also moving through construction.

## Best contacts
1. Jegar Keeney — Director of Design & Construction
2. Johnathan Davila — Director of Construction
3. Luis Rodriguez — Project Manager, Pre-Construction
4. Rachel Gibney — Procurement Director

## Offer
HSC will review the three Houston projects and provide a local execution plan covering surveys, permitting, fabrication, electrical, and installation before asking Wonder to award the work.

## Suggested email
Jegar —

I run Houston Sign Crafters, a UL-listed sign manufacturer based in Houston. I reached out because Wonder has several Houston-area locations now moving through construction.

We noticed the Dennis St. and Yale St. projects specifically call signage out under separate permits, along with the Spring Stuebner location coming online.

We handle survey, landlord coordination, permitting, UL fabrication, electrical work and installation locally.

Before emailing you, we reviewed the three projects and put together a short Houston signage brief covering permitting, likely scope and how we'd support the rollout.

Would it be useful if I sent that over? We'd love the opportunity to bid the Houston projects as they come up.
```

---

# 31. Product Principle

The system should optimize for one behavior above everything else:

> **Do the work before asking for the work.**

Every lead should arrive in HSC's inbox with enough context that the outreach feels like a useful project conversation, not a generic sales pitch.
