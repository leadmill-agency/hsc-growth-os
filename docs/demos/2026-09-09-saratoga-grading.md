# PB11 graded against HSC's own takeoff — Saratoga Commercial (PlanHub)

Method: ran PB11 live on the Saratoga package (46MB combined plan set + PlanHub invite),
**deliberately excluding** HSC's proposal/takeoff PDF from ingestion, then compared the
analyzer's brief against that human takeoff (prepared 2026-08-28) as the answer key.
Run time: 82 seconds.

## Scope identification — near item-for-item match

| Human takeoff (answer key) | Analyzer found it? |
|---|---|
| Building A: standing-seam awnings over 1" square tube (05/A8.4) | ✅ "Standing-seam metal awnings (pre-finished) STN-1" — cited A2.9-A/B roof plans + A3.0 elevations, marked supplier_fab |
| Building B: painted-steel tie-rod canopies (07/A8.4) | ✅ "Steel awnings with tie-rods (painted)" + "Steel canopy (painted)" — cited A3.0-B/A3.1-B, marked supplier_fab |
| GC responsibility: engineered blocking/backing (takeoff RFI-01) | ✅ flagged as risk ("attachment details/anchorage not shown") + unclear item "blocking for sign mounting" |
| Takeoff RFI-02: rod qty/spacing/hardware unverified | ✅ risk "engineering/delegated design required, structural coordination for awnings" |
| Takeoff RFI-04: no manufacturer/finish scheduled | ✅ unknown "finish colors and materials beyond generic notes" |
| A8.4 details 05 & 07 (the sheets the human measured from) | ✅ explicitly flagged: "05 & 07 AWNING/CANOPY DETAILS not provided in excerpt" — it knew exactly which details it was missing |
| ADA/tactile signage, door signage | ✅ found as in-house items — correctly OUTSIDE the human takeoff's canopy-only scope but real sign scope worth pricing |

## What the human did that the analyzer didn't (by design + limitation)

1. **Quantities and dimensions.** The takeoff's core numbers — 4 EA × 17'-4" × 2'-6",
   HC-02 = 14'+2'+14'+2'+14' = 46'-0", totals 126.33 LF / 301.58 SF / 6 rods — come from
   measuring drawing geometry. The analyzer produced **zero quantities**, which is the
   hard rule working as intended (never infer quantities), but it means the takeoff
   itself stays 100% Jamal. Automating measured takeoff would need vision on the
   sheets — a real future upgrade, not v1.
2. **Takeoff RFI-03** (roof plan says "open steel awning", elevations say "painted steel
   awning with tie-rods") — the analyzer listed both names but didn't call out the
   terminology conflict explicitly.
3. **"FOR REVIEW ONLY / placeholder dates" warning** (takeoff RFI-05) — missed; likely
   outside the keyword-excerpt windows.

## Verdict

The analyzer reproduces the *scope-identification and risk half* of a professional
takeoff — the right assemblies, the right sheets, the right fabrication split, 3 of the
5 human RFIs — from a 46MB plan set in 82 seconds. It does not and should not replace
the measured takeoff. Practical division of labor: PB11 does day-1 triage, sheet
pulling, risk/RFI drafting, and supplier RFQs; Jamal measures and prices.

Improvement backlog from this grading: explicit terminology-conflict detection,
document-status warnings (FOR REVIEW ONLY / placeholder dates), and eventually
sheet-vision takeoff assist.
