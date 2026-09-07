# HSC Growth OS — Social Extension

This extension adds PB19–PB21 to HSC Growth OS.

## Files

1. `pb19_social_content_engine_prd.md` — create → review → post → measure loop.
2. `pb20_social_engagement_referral_engine_prd.md` — comment/inbound engagement → qualification → reply → CRM/referral.
3. `pb21_creative_intelligence_engine_prd.md` — content genome + learning + organic/paid feedback loop.
4. `viralbench_architecture_to_pb19.md` — technical teardown of ViralBench and direct implementation map.
5. `hsc_social_content_genome_50_experiments.md` — 50 initial experiments, first 12 to run, controlled test pairs, capture system.

## Key implementation constraint

Do not build `like → automated Instagram cold DM` as an official-API workflow. Instagram official messaging is conversation/comment-triggered; PB20 uses eligible comment private replies, inbound conversations, and manual relationship tasks for non-messageable public engagement.

## Recommended build sequence

PB21 genome schema first → PB19 Golden Path → PB20 comment/inbound Golden Path → PB21 analytics loop. The schema should exist first because every PB19 post should be tagged from day one.
