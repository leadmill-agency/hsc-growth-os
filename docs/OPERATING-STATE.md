# Growth OS — operating state (resume here)

Last updated 2026-09-23. Read this first when you start a new session on the Growth OS.
It describes what the portal does today, the owner's standing rules, the live numbers,
and what is still open. Engineering rules learned in production are in
[`AGENTS.md`](../AGENTS.md) under "Field-learned rules"; the product plan is the master PRD
in `docs/prds/`.

## What the portal is for

The Growth OS finds **large repeat-buyer accounts in Greater Houston and named people
at them that Rameel can email**. It is not a project feed. If he wanted small one-off
jobs, he would scroll TDLR himself. Every screen should serve that goal.

Production runs on Railway at `https://hsc-growth-os-production.up.railway.app`. Pushing
to `main` deploys. The app sits behind a team password page (`APP_PASSWORD`). Never enter
it in a browser; check changes by build, tests, and direct database queries instead.

## How a lead moves through the portal

1. **Morning intake (~8am Houston, automatic).** TDLR filings from 9 Greater Houston
   counties, City of Houston certificates of occupancy, 4 web-scout searches for
   franchise and multi-location news, and forwarded PlanHub bid emails. The radar scores
   each signal and creates at most one card per company.
2. **Opportunities: one compact table with three tabs.**
   - *Rollouts* (the default tab): franchises, multi-unit operators, developments. These
     never expire.
   - *One-off projects*: archive themselves after 7 idle days. **Keep** pins a card; a
     fresh signal brings an archived card back.
   - *Bid invites*: **Bid this** sends the bid to the bid desk.
   - **Pursue** starts research (about 5 minutes). Runs start one per minute, so rapid
     clicks are safe. The dismiss reason is optional.
3. **Research, contacts, and email addresses (automatic after Pursue).** Research writes a
   plain-English brief. Apollo people search finds decision-makers by job title when the
   research names nobody. Apollo, then Hunter, finds each person's work email. If no one
   at the company can be reached, the card dismisses itself with a visible reason.
4. **Researched → Companies is a decision queue.** Each card shows the bottom line, a
   "How to approach" box that names people first, and contact chips with email status.
   **Write email** or **Company swarm** is the decision, and the card leaves the queue
   immediately. If the draft is rejected, the card comes back.
5. **Researched → Outbox.** Drafts wait here for review and editing. Approving *queues*
   an email rather than sending it. Queued emails send 9:00am to 5:30pm Houston time on
   weekdays, about 5 minutes apart, BCC'd to ray@. **Cancel** works until the moment an
   email sends. There is one pending draft per company at most.
6. **Researched → Bids** is the bid desk: upload the plans, run QA, mark submitted, then
   follow-ups run automatically.
7. **Weekly SEO scan (Mondays).** It drafts one city × product page (PB16) and one
   article from live Google Search Console gaps (PB17). Both land in Outbox → Other
   approvals. Publishing to the website repo stays a human or Claude step.

## Owner rules in force (Rameel)

- **Nothing researches by itself.** Auto-pursue stays off.
- **Greater Houston only**, within about 50 miles of downtown, for generated
  opportunities. Canopy and awning work counts statewide, and inbound bid invites are
  exempt from the radius (2026-09-22).
- **A contact must be a person who works at the company.** Never store an architect,
  engineer, broker, filing agent, or company-as-contact, and never suggest emailing one
  (2026-09-21).
- **No Fortune-1000 corporate chains.** Franchisee-led buildouts still count.
- **Company-level duplicates are suppressed.** Once a company is dismissed, won, or lost,
  its signals are ignored for 90 days.
- **No email address, no draft.** Contact chips have a paste-email field for manual finds.
- **Business focus:** exterior signs with orders of $4k and up (pole, monument,
  storefront, channel letters), repair and refurbishment, and commercial awnings and
  canopies. Awnings and canopies are **fabricated in-house**. Never target banners, vinyl,
  or wraps, and never say HSC "outsources" work. Full rules are in `HSC/CLAUDE.md`.

## Live numbers as of 2026-09-23

- **15 emails delivered** through the send queue. Nothing is queued right now.
- **15 drafts waiting in Outbox:** Fitstop, H&H Bagels, Donatos, Birds Houston,
  Kidventure, Laundrolab, Sullivan Brothers, Jefferson Dental, AFC Urgent Care, Storage
  King, Crux Climbing, Epic Foot & Ankle, Midnight Cravingz, EōS Fitness, Allied Exteriors.
- **Companies queue:** 2 cards waiting for a decision. 28 cards are "pursuing" (a draft
  exists or the email was sent).
- **Apollo:** paid plan with about 2,400 credits per cycle, renewing Oct 12. Roughly 100
  credits went on the Sep 21–22 enrichment backlog.
- **OpenAI:** a quiet day costs about $1.50–3. The $24 on Sep 21 was one-time backfill
  work, not the new baseline.

## Open items, most urgent first

1. **Incoming bids are failing (PB10).** Two PlanHub invites (9/22 and 9/23) failed at the
   `recommend` step with `Cannot read properties of undefined (reading 'opportunityId')`.
   The step reads `records.opportunityId`
   (`src/lib/ploybooks/pb10-incoming-bid/definition.ts` around line 207) when the step
   that produces `records` did not run. Fix the null path, then retry runs `f3863acf…`
   and `410b5dab…`.
2. **Some research runs fail on a missing website field (PB01).** When the AI leaves out
   `company.official_website`, validation rejects the run. The field is
   `z.string().nullable()` at `src/lib/actions/research.ts:24`, and the OpenAI call uses
   `strict: false`, so the AI can omit it. Change it to accept a missing value, then retry
   runs `f07982f6…` and `b9b09c4b…`.
3. **Two questions still waiting on Rameel:** does the 5-year warranty cover awnings and
   canopies, and what do awnings typically cost? Keep both off the website until he
   answers.
4. **Weekly SEO scan:** the Monday 9/21 drafts (Sugar Land × Channel Letter Signs, and
   "sign shop houston tx") were rejected in the portal, then approved by Rameel on 9/23 and
   published: `/channel-letter-signs-sugar-land-tx` and `/blog/sign-shop-houston-tx`. The
   article was reframed as a buying guide because the draft duplicated the permit post.
   Watch that PB17 drafts match the search intent, not only the keywords.
5. **Not built yet:** detecting replies (a reply should pause follow-ups and flag the
   company) and chasing supplier quotes for bids.

## Working against production

- **One-off production queries:** write a script inside `scripts/` in this repo, named
  `scripts/_tmp-*.ts`. It must live in the repo because `tsx` cannot resolve `drizzle`
  from the scratchpad. Load `.env` with the pattern `^([A-Z0-9_]+)=` (digits matter),
  run it with `npx tsx`, then delete it.
- **Reading raw SQL results:** `db.execute` returns a bare array with postgres-js
  (production) and `{ rows }` with PGlite (tests). Handle both.
- **Reusable repair scripts:** `run-intake-now.ts`, `run-seo-scan-now.ts`,
  `dedupe-company-cards.ts`, `backfill-scale.ts`, `repolish-briefs-v2.ts`,
  `rebuild-people-layer.ts`.
- **Before shipping:** run `npx tsc --noEmit && npx vitest run` (69 tests pass) and
  `npm run build`, then push to `main`.
- **Apollo endpoints:** `people/match` returns emails and org context. Discovery uses
  `mixed_people/api_search`, which returns an id and a partly hidden name; reveal the
  person with `people/match {id}`. The older `mixed_people/search` returns HTTP 422 for
  API callers.
