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
