# Demo — Harvey Golden Path, live (2026-09-07)

Master PRD §36 demo executed twice: once as the automated fixture suite
(`src/lib/ploybooks/pb01.golden.test.ts`), once LIVE in the UI with real OpenAI research.

## Live run (from the browser)

1. Pasted a Harvey Cleary / UH bid-notice signal into Opportunities → Run radar (PB05).
2. Radar parsed it, created deduplicated account/project/opportunity, scored it, suggested PB01.
3. Clicked Pursue → PB01 ran in the background (~5.5 min, mostly gpt-5 web research).
4. Research returned Harvey-Cleary's real public leadership (verified) and correctly marked the
   unnamed Houston preconstruction lead as `unknown` instead of inventing one.
5. Fit scored 74 → REVIEW; missing stakeholder roles surfaced in the approval summary.
6. Outreach draft: 88 words, one CTA, one verified fact (UH MRB notice soliciting "Signage"),
   correct sales-process language ("call → survey → mockup + itemized estimate; no quotes
   before a survey").
7. Approved in the Approvals inbox → run completed, opportunity → `pursuing`,
   `outreach.approved` event emitted, full activity trail recorded.

## Notes / follow-ups

- §36 item "account page draft" is PB07 (Phase 3) — the only §36 element not yet in the bundle.
- Radar score calibration fixed same-day (model initially read the scale as 0–10).
- Live research latency ~3–5 min/run → runs execute in the background; UI has Resume for
  interrupted runs. A proper worker loop can replace this when we deploy.
- Sending remains draft-only: no send adapter is registered and ALLOW_EXTERNAL_SEND=false.
