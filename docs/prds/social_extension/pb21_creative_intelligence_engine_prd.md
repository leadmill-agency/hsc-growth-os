# PB21 — Creative Intelligence Engine

**Product:** HSC Growth OS v1  
**Ploybook:** PB21  
**Owner:** Houston Sign Crafters Growth  
**Primary user:** Rameel / HSC growth team  
**Version:** 1.0  
**Date:** September 7, 2026  
**Target:** MVP during September 2026  
**Status:** Build-ready  
**Parent spec:** `hsc_growth_os_v1_prd.md`  
**Depends on:** PB19 Social Content Engine, PB20 Social Engagement & Referral Engine, paid-ad performance data, CRM attribution  
**Feeds:** PB19, PB18 Growth Operator, paid-creative workflow

---

# 1. Purpose

Create HSC's persistent creative-learning system. PB21 joins organic social performance, paid Meta creative results, engagement quality, lead quality, pipeline, and won revenue to determine which **content ingredients** actually work—and what experiment HSC should run next.

PB19 creates content. PB20 converts engagement. PB21 is the memory and experimental-design layer that makes both systems improve over time.

## Problem

Without a structured content genome, social analysis degenerates into anecdotes:

> "Before/after posts work."

That is too vague to compound.

A useful system should be able to say:

> "Restaurant before/after videos with a price hook in the first 3 seconds, 15–25 seconds long, human voiceover, and nighttime reveal generated 2.4× HSC's baseline qualified-engagement rate across 6 posts; confidence medium. Run the same hook family on monument signs next."

PB21 makes that possible.

---

# 2. Goals

- Give every organic and paid creative a common set of genome dimensions.
- Normalize performance across platform, spend, audience, format, and post age.
- Prefer qualified conversations/pipeline/revenue over raw engagement when available.
- Separate observation, correlation, and causal experiment.
- Recommend next creative tests with explicit hypotheses.
- Move winners from organic → paid and paid → organic.
- Detect creative fatigue.
- Preserve failed tests so the system doesn't repeat them blindly.
- Feed the weekly PB18 Growth Operator with actionable creative recommendations.

## Non-Goals

- Claim causal certainty from tiny samples.
- Automatically move ad budget in v1.
- Judge creative solely from model aesthetics.
- Optimize for one platform without accounting for platform differences.
- Generate content itself; PB19 performs creation.

---

# 3. Content Genome

Minimum dimensions:

## Format

- before_after
- price_breakdown
- cost_reveal
- mistake_warning
- process
- install_reveal
- shop_floor
- educational
- founder_talking_head
- customer_story
- reaction
- ranking
- comparison
- checklist
- local_commentary
- trend_adaptation
- meme/humor
- carousel
- cinematic
- raw_phone

## Hook family

- price
- mistake/fear
- curiosity
- transformation
- contrarian
- local_identity
- authority
- specific_result
- question
- pattern_interrupt
- list
- confession

## Industry

restaurant, medical, retail, gas_station, franchise, developer, GC, office, industrial, education, hospitality, other.

## Product

channel_letters, monument, pylon, awning, interior, vinyl, wall_graphics, cabinet, wayfinding, service/repair, permit/design, other.

## Proof

real_before_after, completed_project, shop_process, rendering, drawing, customer_quote, number/pricing, employee/expert, external_example, synthetic_broll.

## Human presence

none, owner, salesperson, installer, fabricator, customer, narrator_only.

## Length

0–10s, 11–15s, 16–25s, 26–40s, 41–60s, 60s+.

## CTA

none, follow, save, comment_keyword, DM, get_quote, send_logo, referral_ask, visit_site, question.

## Editing style

raw_phone, fast_cut, miniDV, cinematic, slideshow, talking_head, screen_record, voiceover_broll.

## Audio

native_voice, voiceover, trending_audio, music_low, no_audio, mixed.

---

# 4. Inputs

## Organic

- PB19 SocialPost + ContentExperiment.
- platform metrics snapshots.
- PB20 qualified engagement/conversation outcomes.
- CRM pipeline and revenue attribution.

## Paid

At creative/ad level where possible:

- spend,
- impressions,
- CPM,
- 3s views / hook rate,
- thruplay/watch metrics,
- CTR,
- landing-page views,
- leads,
- qualified leads,
- quotes,
- opportunities,
- won revenue.

## Context

- platform,
- placement,
- audience,
- geography,
- campaign objective,
- post age,
- season/time,
- whether creative was organic-first or paid-first.

---

# 5. State Machine

PB21 is primarily recurring analysis:

`INGESTING` → `NORMALIZING` → `TAG_VALIDATION` → `ANALYZING` → `FINDINGS_DRAFT` → `CONFIDENCE_CHECK` → `RECOMMENDATIONS` → `REVIEW` → `EXPERIMENTS_CREATED` → `OUTCOME_PENDING`

Weekly by default, with event-triggered fast path when a post/creative exceeds a winner threshold.

---

# 6. Performance Normalization

Never compare a 2-hour TikTok post to a 7-day Instagram Reel on raw views.

Create platform/format baselines at standard ages:

- 2h,
- 24h,
- 72h,
- 7d.

Metrics become indexes:

```text
view_index = post_views / median_views(platform, format, age_bucket)
share_save_index = post_share_save_rate / median_share_save_rate(...)
qualified_engagement_index = post_qualified_engagement_rate / baseline
pipeline_index = attributed_pipeline_per_1k_views / baseline
```

Paid metrics normalize against campaign/placement/audience cohort where feasible.

---

# 7. Commercial Creative Score

PB21 should calculate multiple scores, not one opaque number.

### Attention Score

Reach + hold + watch quality.

### Engagement Score

Comments + saves + shares adjusted for reach.

### Commercial Intent Score

Qualified comments + conversations + profile/site intent.

### Pipeline Score

Qualified opportunities + pipeline per impression/view/spend.

### Revenue Score

Won revenue / spend or won revenue / 1k organic views, acknowledging lag.

### Composite

Use PB19 reward weights and mark fields `provisional` when lower-funnel outcomes are immature.

---

# 8. Learning Engine

PB21 generates three classes of output.

## A. Observations

Descriptive only.

> Price hooks are associated with higher saves across 5 restaurant posts.

## B. Hypotheses

Testable.

> Mentioning an actual project price in the first 3 seconds will increase qualified restaurant-owner engagement relative to a transformation-only hook.

## C. Rules / promoted learnings

Require repeated evidence.

Example promotion thresholds:

- minimum 5 relevant experiments,
- effect direction consistent in ≥70%,
- material uplift ≥25%,
- no obvious single-project confound,
- confidence reviewed by human or statistical service.

Rule:

> For restaurant before/after content, prioritize price or mistake hooks over generic reveal hooks.

Rules expire or downgrade if recent evidence contradicts them.

---

# 9. Experiment Design

PB21 should favor **one-variable or limited-variable tests**.

Bad:

> Completely change hook, length, footage, CTA, audio, industry, and editing style.

Good:

> Same restaurant project + same edit; test price hook vs mistake hook.

Experiment record:

```json
{
  "hypothesis": "price hook beats curiosity hook on qualified engagement",
  "control": {"hookFamily":"curiosity"},
  "variant": {"hookFamily":"price"},
  "heldConstant": ["project","format","length","cta","platform"],
  "primaryMetric": "qualified_engagement_rate",
  "secondaryMetrics": ["completion_rate","share_save_rate"],
  "minimumReps": 3
}
```

For organic social where true A/B distribution is noisy, replicate across multiple comparable posts rather than overinterpreting one pair.

---

# 10. Organic → Paid Handoff

Nominate an organic post for paid testing when:

- attention score ≥1.5× baseline, AND
- commercial-intent score ≥1.25× baseline, OR
- it generated a qualified opportunity/revenue despite smaller reach.

Output:

```text
ORGANIC WINNER
Flying Biscuit before/after — $14k price hook

Why:
1.8× completion
2.2× share/save
4 qualified business-owner interactions
1 quote request

Recommendation:
Create 3 paid variants preserving hook + first 8 seconds.
```

PB21 creates a paid-creative task; no budget changes without approval.

---

# 11. Paid → Organic Handoff

If a Meta ad has unusually strong hook/CTR/qualified lead economics, PB21 asks PB19 to adapt the mechanism to native content.

Example:

Ad winner:

> "Don't order your sign before checking this."

Organic experiments:

- "Don't sign your storefront lease before checking this."
- "3 signage mistakes restaurant owners make before opening."
- "Your landlord can reject your sign even after you pay for it."

PB19 should not copy ad language blindly; it should preserve the tested mechanism.

---

# 12. Creative Fatigue

Detect fatigue separately from bad creative.

Paid indicators:

- frequency rising,
- CTR falling,
- qualified CPL worsening,
- same genome cluster saturating.

Organic indicators:

- repeated format gets declining normalized retention across comparable posts,
- audience/comment novelty declines.

Output:

> "Restaurant before/after remains a winner, but the exact `$X transformation` hook is fatiguing. Keep format; rotate hook family."

This distinction prevents throwing away a good format because one execution is stale.

---

# 13. UI — Creative Intelligence

## What's Working

Cards:

```text
🔥 PRICE HOOK × RESTAURANT × BEFORE/AFTER
Confidence: Medium
Samples: 6
Qualified engagement: 2.4× baseline
Pipeline: $38k

[View evidence] [Create next test]
```

## What Isn't

Only show patterns with enough evidence.

## Experiments Running

Hypothesis, variants, reps, current evidence, target metric.

## Organic → Paid Candidates

Ranked list with reasons.

## Paid → Organic Candidates

Ranked list.

## Genome Explorer

Filter by any dimension and see:

- sample count,
- attention index,
- commercial index,
- pipeline,
- confidence.

---

# 14. Data Model Additions

```ts
type CreativeLearning = {
  id: string;
  kind: 'observation'|'hypothesis'|'rule';
  statement: string;
  dimensions: Record<string,string|string[]>;
  sampleCount: number;
  effectSize?: number;
  confidence: number;
  supportingExperimentIds: string[];
  contradictingExperimentIds: string[];
  createdAt: string;
  lastValidatedAt?: string;
  status: 'active'|'testing'|'weakened'|'retired';
}

type CreativeTestPlan = {
  id: string;
  hypothesisLearningId?: string;
  hypothesis: string;
  controlGenome: Partial<SocialContentGenome>;
  variantGenome: Partial<SocialContentGenome>;
  heldConstant: string[];
  primaryMetric: string;
  minimumReps: number;
  status: 'planned'|'running'|'complete'|'cancelled';
}
```

---

# 15. Agent Rules

- State sample size on every finding.
- Do not call one post a trend.
- Separate current external trend evidence from HSC performance evidence.
- Do not optimize away commercial relevance for view gains.
- Prefer mechanism-level insight over copying exact content.
- Always include at least one falsifiable next experiment.
- A revenue-producing low-view post can be a winner.
- A viral post with zero commercial signal should be labeled an attention winner, not a business winner.
- Track uncertainty and attribution quality.

---

# 16. Events

Consume:

- `social.metrics.updated`
- `social.post.high_performer`
- `social.engagement.qualified`
- `social.opportunity.created`
- `opportunity.won`
- paid creative metric events

Emit:

- `creative.learning.created`
- `creative.rule.promoted`
- `creative.test.created`
- `creative.organic_winner.nominated_for_paid`
- `creative.paid_winner.nominated_for_organic`
- `creative.fatigue.detected`

---

# 17. Acceptance Criteria

1. Every PB19 post and at least Meta ad creative can be represented in the shared genome.
2. Metrics are normalized by relevant platform/age/cohort rather than raw-only comparison.
3. PB21 can query performance by any genome dimension.
4. Findings always show sample count and confidence.
5. System can create an explicit test plan and hand it to PB19.
6. System can nominate organic winners for paid and paid winners for organic.
7. Qualified engagement/pipeline/revenue can override raw-view ranking.
8. At least one creative rule can move through observation → hypothesis → promoted rule with evidence IDs.
9. PB18 can consume top 3 weekly creative findings/actions.
10. Findings remain auditable to original posts/ads and CRM outcomes.

---

# 18. Claude Code Implementation Checklist

- [ ] Implement genome taxonomy + tags.
- [ ] Add normalization cohorts.
- [ ] Add Attention/Engagement/Commercial/Pipeline/Revenue scores.
- [ ] Implement CreativeLearning + CreativeTestPlan.
- [ ] Add sample-size/confidence handling.
- [ ] Build Creative Intelligence UI.
- [ ] Add organic→paid nomination.
- [ ] Add paid→organic nomination.
- [ ] Add fatigue detection.
- [ ] Add PB19 experiment handoff.
- [ ] Add PB18 weekly summary handoff.

---

# 19. Start Prompt for Claude Code

> Read the master PRD, PB19, PB20, and this PB21 PRD. Implement PB21 as a shared analytics/learning service over organic social, paid creative, and CRM outcomes. Do not start with an LLM summary screen. Start with a strict content-genome schema, metric normalization, experiment records, and evidence-backed findings. Build the Golden Path: PB19 publishes three restaurant before/after experiments → metrics + PB20 qualified-engagement outcomes arrive → PB21 compares a price-hook cluster to baseline → creates a medium-confidence hypothesis → proposes a controlled next PB19 experiment → user approves → child experiment is created. All findings must show sample count, evidence IDs, and confidence.
