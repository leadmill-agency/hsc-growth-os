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

- **Nothing researches by itself.** `AUTO_PURSUE_ENABLED` stays false; a human clicks Pursue.
  Funnel: Opportunities = one triage inbox (Pursue / Bid this / Dismiss-with-reason) →
  Researched hub (briefs + emails + bid desk). Dismissals REQUIRE a reason code — they feed
  radar scoring as ground truth (except `unclear` = presentation feedback, and system
  `opportunity.deduped` actions, which the feedback loop deliberately ignores).
- **One radar card per company** (`dedupeAccountWide` in `createOpportunity`, used by PB05):
  the scout re-tells the same story daily with new wording, so (account, project) dedupe
  alone re-carded dismissed companies. Re-sightings attach to the active card; a closed card
  (dismissed/won/lost) suppresses re-carding for **90 days** from close, then the company may
  earn a fresh card. Bids stay one-card-per-project (never set the flag in PB10).
- **Fortune-1000-scale corporate chains never become cards** (`national_chain` in PB05's
  parse): their sign packages run through national vendor programs. Franchisee-driven
  buildouts and emerging brands DO card — the local operator buys the signs. Skips are
  logged to History (`radar.national_chain_skipped`).
- **The boot sweep must not steal runs.** Scripts execute runs against the same database
  from outside the server process; a boot sweep with `runningOlderThanMs: 0` adopted a
  mid-draft run and produced duplicate approvals (2026-09-18). Runs heartbeat `updatedAt`
  at each step start — boot threshold 10 min, steady 15 min. If a step ever has duplicate
  approvals anyway, the runner honors the first human decision and supersedes the rest.
- **Cross-bundle module state is unreliable in Next** (instrumentation vs server-action
  bundles): the send layer lazily self-registers the Resend adapter. Never assume a
  register-at-boot singleton is visible from a server action.
- **Hard zod `.max()` on AI output is guidance-as-fatal** — it killed PB16/PB17/PB18 runs.
  Keep limits out of the schema; clamp in code after generation. `z.toJSONSchema` throws on
  `.transform`, so transforms can't do it either (verified live).
- **Models copy the vocabulary they're shown**: pre-translate metrics/fields to plain
  English before prompting (PB18 `describeMetrics`, brief composition from labeled text,
  outreach never says "registered with TDLR"). Outreach voice = `OWNER_VOICE` in
  `src/lib/actions/outreach.ts` (his real reply-getting emails; routing-question CTA;
  one-thought paragraphs; brochure-speak banned).
- **Weekly SEO scan** (`src/lib/integrations/seo-scan/weekly.ts`): Mondays after intake,
  PB16 drafts one city × product page and PB17 one article, behind publish approvals.
  Topics come from live GSC content gaps first (backlog fallback), filtered by
  `OFF_FOCUS_PATTERN` (banners/vinyl/wraps never get content — outsourced-lead territory,
  see HSC/CLAUDE.md business focus). Coverage/dedupe is keyword-STEM based
  (`findTopicCoveringUrls` / `topicsOverlap` in the sitemap integration) — a slug-substring
  check shipped a near-duplicate of an existing blog post. Manual run:
  `npx tsx scripts/run-seo-scan-now.ts`. When a draft overlaps an existing page, MERGE the
  new material into that URL; never publish a twin.
- **Canopy/awning scope is valid STATEWIDE** and never auto-passes; signage-only is
  ~150 mi of Houston. PB10 PASS recommendations auto-close visibly (activity + reason).
