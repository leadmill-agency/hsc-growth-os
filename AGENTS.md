<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# HSC Growth OS

Internal AI-native revenue operating system for Houston Sign Crafters. **Source of truth: `docs/prds/hsc_growth_os_v1_prd.md` (master PRD) + the 18 PB PRDs beside it.** Read the master PRD sections you're touching before coding. `docs/prds/ADDENDUM-2026-09-06.md` holds the decision log; `docs/prds/inputs/hsc_expansion_radar_prd.md` is a signal-source/fixture input, not scope. Track progress ONLY in `docs/BUILD-STATUS.md`.

## Stack

Next.js 16 (App Router, TS, Tailwind 4, src-dir) · Drizzle ORM · Postgres (Supabase in prod; **PGlite in dev/tests** — `DATABASE_URL` unset ⇒ PGlite at `.data/dev` automatically) · Vitest · zod for every AI/structured payload.

- `npm run dev` / `npm test` / `npm run db:generate` (drizzle migrations from `src/lib/db/schema/`)
- Job runner is **database-backed** (`src/lib/ploybooks/runner.ts`), not an external queue. Don't add Trigger.dev/Inngest/Temporal without a demonstrated need.

## Engineering rules (master PRD §33 — binding)

1. Migrations before schema changes (`drizzle-kit generate`); never hand-edit applied migrations.
2. All AI output is structured (zod-validated JSON) through `src/lib/ai/client.ts` (`LLMClient`). **No direct model calls anywhere else.** The output envelope (summary/facts/assumptions/unknowns/risks/recommended_next_action/writebacks) is in `src/lib/ai/envelope.ts`.
3. Evidence (`evidence` table) is stored separately from generated summaries; material AI-derived facts carry `verified|inferred|assumed|unknown` + confidence + source. Missing data stays in `unknowns` — never fabricated.
4. Long-running work = Ploybook steps: resumable, idempotent, visible failure. Explicit state machines, no free-form autonomous loops.
5. Outbound actions (email/publish/submit/spend) are idempotent AND gated behind an `Approval`. **The send layer must refuse to send unless `ALLOW_EXTERNAL_SEND=true`** — never true in dev/test. No email is ever sent from dev.
6. Ploybook steps compose the shared action library (`src/lib/actions/`) — a PB may ADD shared actions, never create private variants of existing ones.
7. Integrations live behind adapters in `src/lib/integrations/` with fixture/manual fallbacks; every PB must run end-to-end on fixtures with zero live connectors.
8. Reuse the shared entities (master PRD §9). Never create parallel/duplicate record types; dedupe on create (domain, address, name).
9. Build one full real flow before generalizing; no premature agent frameworks.
10. Test with fixtures in `src/fixtures/` (golden cases per master PRD §34).

## The per-Ploybook build loop (no exceptions)

1. Read the PB's PRD + referenced master sections. 2. Create its golden fixture from real HSC data first. 3. Implement per the PB PRD's §15 checklist: definition/state machine → scoring → steps as shared-action compositions → events → UI. 4. Gate: the PB PRD's §14 acceptance criteria pass as automated tests (incl. rerun-idempotency, approval-blocking, error/retry). 5. Record in `docs/BUILD-STATUS.md` + demo notes in `docs/demos/`.

A PB is done only per its own Definition of Done. Phase order is master PRD §26/§41 — sequence, not dates. If throughput slips, protect Tier A (PB01, 05, 10, 11, 13, 14, 18) per §28.

## Product guardrails

- Human approval before: sending anything external, publishing public content, submitting bids, changing price/spend, buying credits/subscriptions, multi-contact sends at one account.
- Cold outreach: ≤150 words, one CTA, evidence of research, no fake flattery; copy must match the real sales process (call → survey → mockup WITH estimate; **never** imply instant quotes or mockup-before-survey).
- Cold outbound uses a separate sending domain, never the primary houstonsigncrafters.com mailbox.
- Contact data from research (incl. radar PRD §16 seed names) must be verified via Apollo/LinkedIn before any email.
- ABM/proposal pages are private + noindex. Never expose W-9s/COIs/bid docs publicly.

## Field-learned rules (live ops, 2026-09 — each learned the hard way)

**Resuming work? Read [`docs/OPERATING-STATE.md`](docs/OPERATING-STATE.md) first** — current
UI flow, owner rules in force, live numbers, and the prioritized open items.

### Funnel and triage
- **Nothing researches by itself.** `AUTO_PURSUE_ENABLED` stays false; a human clicks Pursue.
- **Opportunities = one compact table**, tabs Rollouts (default) / One-off projects / Bid
  invites, split by `opportunities.scale` (radar classifies at parse; torn → one_off).
  One-offs idle 7 days archive (`archive-sweep.ts`; `pinned` = Keep exempts; stage
  `archived`, NOT dismissed); a fresh signal resurfaces an archived card. Rollouts never expire.
- **Dismiss reason is OPTIONAL** (2026-09-22). When given it feeds radar calibration;
  `unclear` is presentation feedback. System actions (`opportunity.deduped`,
  `opportunity.auto_dismissed`, `opportunity.archived`) are deliberately NOT
  `opportunity.dismissed` so the radar only ever learns from human judgment.
- **Researched = decision queue + Outbox + Bids.** Write email / Company swarm flip the card
  to `pursuing` the moment a draft exists; rejecting an outreach draft returns it to
  `researched`. One pending draft per opportunity — retried runs + double clicks stacked
  duplicates that would double-email people.

### Radar gates (PB05 parse → before any card exists)
- **Greater Houston only** (`greater_houston`, ~50 mi). Exceptions: canopy/awning scope
  (statewide), TDLR/CoH sources (local by construction — the LLM mis-placed thin CO names),
  and inbound bids (PB10 never uses the gate). TDLR pulls 9 counties.
- **No Fortune-1000 corporate chains** (`national_chain`); franchisee buildouts pass.
- **One card per company** (`dedupeAccountWide`, PB05 only; bids stay per-project). Re-
  sightings attach to the active card; a closed card suppresses for 90 days from close.
  `createAccount` also merges LLM name variants by word stems ("DECA Dental" / "DECA
  Dental Group") — without that, suppression leaked across the AI's phrasing.
- Adding a required field to a radar/research zod schema means updating the three parse
  fixtures (`fixtures/harvey.ts`, `scout.test.ts`, `pb01.golden.test.ts`).

### Contacts and email (the portal's purpose)
- **THE CONTACT RULE: a person employed AT the company.** `isPersonAtCompany`
  (`contact-enrichment.ts`) gates every contact writeback; stakeholder + brief prompts ban
  recommending architects/A-E/brokers/filing agents. Owner: "those are never useful."
- **Address first:** `writeEmailAction` resolves a sendable address (stored → Apollo →
  Hunter, up to 4 people) BEFORE drafting and targets the reachable person. No address → no
  draft, a `outreach.no_address` activity, and a paste-email field on the chip.
- **Enrichment runs every tick** for every person-at-company on active cards, once each
  (`emailLookupAt`). **Discovery** (`discoverContactsForUncovered`) runs Apollo
  `mixed_people/api_search` by decision-maker title for accounts with nobody reachable,
  then reveals by id via `people/match` (1 credit). Accounts still unreachable after both
  auto-dismiss (`autoDismissUnreachable`).
- **Moved-on guard must be org-aware:** mail domains often differ from website domains
  (Twin Peaks: site twinpeaksrestaurant.com, mail tprest.com). Trust Apollo's org match,
  mail domains other contacts at the account already use, and 2+ same-domain results in a
  batch; flag moved-on only when Apollo names a DIFFERENT company. A naive domain check
  discarded valid VP emails and the auto-dismiss sweep then killed a top card.
- **Apollo quota errors (402/403/429) throw `FinderQuotaError`** — never treat "out of
  credits" as "no email exists"; the pass pauses without marking contacts attempted.
- Apollo deprecated `mixed_people/search` for API keys (HTTP 422) — use `api_search`.

### Sending
- **Approve = queue, not send** (`send-queue.ts`, minute tick): 9:00am–5:30pm CT weekdays,
  ~5 min apart with jitter; daily-cap overflow reschedules to the next morning; failures
  revert to pending with the error on the card. `sendExternal` stays the only send path.
- **Cross-bundle module state is unreliable in Next**: the send layer lazily self-registers
  the Resend adapter — never assume a boot-time singleton is visible from a server action.

### Runs, AI, and cost
- **The boot sweep must not steal runs**: scripts execute runs against the same database;
  boot threshold 10 min, steady 15 min (runs heartbeat `updatedAt` per step). Duplicate
  approvals on one step → first human decision wins, rest superseded.
- **Parallel Pursues tripped OpenAI's 2M tokens/min limit** and killed all four runs:
  OpenAI clients use `maxRetries: 6`, and new Pursues queue while research is running — the
  minute tick starts one queued run per minute.
- **Hard zod `.max()` on AI output is guidance-as-fatal**; clamp in code. `z.toJSONSchema`
  throws on `.transform`. With `strict: false`, the model can OMIT fields — a
  `.nullable()` field still fails on `undefined` (see open item in OPERATING-STATE).
- **Models copy the vocabulary they're shown**: pre-translate fields to plain English.
  Brief `how_to_approach` = 2–4 sentences, names first, employees only, no numbered plans
  (`research-brief.ts`). Outreach voice = `OWNER_VOICE` in `outreach.ts`.
- **Scout** = 4 Houston-aimed themes, 60s apart. Cost baseline ~$1.50–3/day; Sep 21's $24
  was one-time backfills + parallel deep research.

### SEO scan
- Mondays: PB16 city × product page + PB17 article, topics from live GSC gaps first
  (backlog fallback), filtered by `OFF_FOCUS_PATTERN` (banners/vinyl/wraps never).
  Products include Commercial Awnings (statewide; in-house fabrication; no warranty or
  price claims until confirmed). Coverage checks are keyword-STEM based; when a draft
  overlaps an existing page, MERGE into that URL — never publish a twin.
- PB10 PASS recommendations auto-close visibly; canopy/awning scope never auto-passes.
