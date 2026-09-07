# PB19 — Social Content Engine

**Product:** HSC Growth OS v1  
**Ploybook:** PB19  
**Owner:** Houston Sign Crafters Growth  
**Primary user:** Rameel / HSC growth team  
**Secondary users:** Sales, production, installation, design  
**Version:** 1.0  
**Date:** September 7, 2026  
**Target:** MVP during September 2026  
**Status:** Build-ready  
**Parent spec:** `hsc_growth_os_v1_prd.md`  
**Depends on:** PB18 Growth Operator; shared Asset Library, SourceEvidence, Approval, Event, and Ploybook Runner infrastructure  
**Feeds:** PB20 Social Engagement & Referral Engine; PB21 Creative Intelligence Engine

---

# 1. Purpose

Build an agentic social-content loop for Houston Sign Crafters that researches winning short-form formats, selects commercially relevant ideas, creates TikTok/Instagram content from HSC assets, routes drafts for approval, publishes them, measures results, and generates the next batch from observed performance.

The product is inspired by ViralBench's agentic loop but changes the reward function. ViralBench optimizes for views. HSC must optimize for **qualified local attention that produces conversations, referrals, pipeline, and revenue**.

## Problem

HSC has unusually strong raw material for short-form content—before/after transformations, fabrication, installers, cranes, illuminated signs, permit mistakes, customer stories, drawings, pricing, and physical projects—but converting that material into consistent daily distribution currently requires manual ideation, editing, scheduling, analysis, and iteration.

Generic social schedulers solve publishing. Generic AI copy tools solve drafts. Neither creates a closed learning loop.

PB19 should behave like a junior content strategist who can:

1. inspect HSC's own performance,
2. study current winning formats,
3. select ideas appropriate for HSC,
4. find the right raw assets,
5. build post-ready drafts,
6. ask for approval,
7. publish,
8. observe results,
9. write structured learnings back to PB21.

## Goals

- Produce a reliable daily queue of 1–2 strong posts per platform without requiring Rameel to ideate every post.
- Use HSC's real project footage whenever possible; AI generation supplements rather than replaces proof.
- Treat every post as a structured experiment with known variables.
- Optimize for qualified Houston/Texas commercial attention, not raw virality alone.
- Support Instagram Reels/carousels and TikTok videos/photo posts.
- Preserve a human approval gate before publishing in v1.
- Feed performance and creative metadata into PB21.
- Create content that PB20 can convert into comments, DMs, referrals, and leads.

## Non-Goals

- Fully synthetic influencer accounts in v1.
- Automatically roasting or naming businesses without explicit approval.
- Publishing fabricated customer results, project values, or pricing.
- Automatically replying to or messaging every engager.
- Treating follower count or views as the primary business outcome.
- Building a full nonlinear video editor from scratch when an external creation/publishing layer can be used.

---

# 2. Reward Function

PB19 must not optimize a single vanity metric.

For each post, calculate a `commercial_content_score` after the measurement window:

```text
10% Reach quality
10% Hold / watch quality
10% Saves + shares
10% Profile / account intent
15% Qualified local engagement
15% Conversations created
15% Qualified leads / opportunities created
15% Pipeline / attributed revenue
```

During the first 30 days, when lower-funnel data is sparse, use proxy weights:

```text
15% Views vs account baseline
20% Retention / completion
15% Save-share rate
15% Comment quality
15% Qualified profile/commenter count
10% Profile / website actions
10% conversations / leads
```

Raw views may never represent more than 20% of the reward function.

### Qualified local attention

A viewer/engager is more valuable if there is evidence they are:

- in Greater Houston or a target Texas expansion market,
- a business owner/operator,
- a restaurant/franchise operator,
- a developer/GC/architect/property manager,
- a facilities/real-estate/procurement professional,
- associated with a company with physical locations,
- actively opening/remodeling a location,
- connected to an existing target account.

PB19 does not need to identify every viewer. It must use these signals when platform/API data legitimately exposes them.

---

# 3. Trigger & Cadence

## Scheduled triggers

- **07:00 CT daily:** research + create morning batch.
- **16:00 CT daily:** review new performance, optionally create evening/next-day batch.
- **Monday 06:30 CT:** broader weekly content thesis refresh with PB21.

## Event triggers

- New completed HSC project added to Asset Library.
- New before/after pair created.
- High-performing organic post crosses a PB21 threshold.
- High-performing Meta ad creative is nominated by PB21 for organic adaptation.
- Major local/project event produces a timely content angle.
- Rameel manually requests a post about an account, project, product, or topic.

## Run limits for MVP

- Maximum 3 candidate posts generated per run.
- Maximum 2 approved posts queued per day/platform by default.
- Do not create more than 10 expensive AI video/image generations per candidate before surfacing a failure/review state.

---

# 4. Inputs

## Required

- Social account configuration.
- HSC Brand Context.
- Social Content Genome taxonomy.
- HSC Asset Library.
- Last 30–90 days of HSC post performance.
- PB21 current creative learnings.

## Optional / enrichers

- Current TikTok/Instagram research provider such as Lightreel.
- Competitor and adjacent-industry post URLs.
- Meta Ads creative performance.
- Google Search Console / SEO topics.
- HSC CRM industries and won jobs.
- Seasonal/local events.

## Asset Library minimum metadata

Each asset should support:

```ts
type SocialAsset = {
  id: string;
  url: string;
  mediaType: 'video'|'photo'|'rendering'|'drawing'|'screenshot'|'logo'|'audio';
  projectId?: string;
  accountId?: string;
  productTypes: string[];
  industries: string[];
  geography?: string;
  stage?: 'before'|'design'|'fabrication'|'install'|'after'|'night_reveal'|'other';
  peopleVisible?: string[];
  customerApprovedForMarketing: boolean | 'unknown';
  capturedAt?: string;
  qualityScore?: number;
  notes?: string;
}
```

Assets with `customerApprovedForMarketing = false` cannot be used. `unknown` must be surfaced for review when the customer/project is identifiable.

---

# 5. State Machine

`SIGNAL_COLLECTION` → `RESEARCHING` → `IDEATING` → `SCORING` → `ASSET_MATCHING` → `DRAFTING` → `RENDERING` → `SELF_REVIEW` → `HUMAN_REVIEW` → `APPROVED` → `QUEUED` → `PUBLISHED` → `MEASURING` → `LEARNING_WRITTEN`

Alternate states:

- `NEEDS_ASSET`
- `NEEDS_FACT_CHECK`
- `REJECTED`
- `PUBLISH_FAILED`
- `MEASUREMENT_INCOMPLETE`

No rejected concept should be silently regenerated in materially identical form within 14 days unless the user asks.

---

# 6. End-to-End Workflow

## Step 1 — Read account history first

Before external research, inspect HSC's recent post table:

- views/reach,
- 1s/3s hold if available,
- average watch time,
- completion rate,
- saves,
- shares,
- comments,
- profile actions,
- follower change,
- link actions,
- DMs/conversations,
- CRM opportunities/revenue linked to post.

Calculate performance relative to HSC's own baseline by platform and format.

Do not declare a format dead from one weak post. Require either multiple reps or strong contradictory evidence.

## Step 2 — Research current winning patterns

Use social intelligence to answer high-leverage questions such as:

- What short-form formats are currently breaking out in local-service, construction, restaurant, real-estate, automotive, home-service, manufacturing, and transformation content?
- What exact opening mechanisms are common among high-performing posts?
- Which formats can be recreated with authentic HSC media?
- Which posts create business-owner comments rather than consumer entertainment only?

Research should return examples with URLs, hook/structure, format, and explanation.

PB19 should preferentially study **whole posts**, not just hook lists. When possible, inspect complete carousel/video structures.

## Step 3 — Generate candidate theses

Each candidate must have:

- target persona,
- commercial objective,
- content-genome fields,
- hook thesis,
- structure,
- required assets,
- source inspiration,
- CTA,
- expected learning.

Example:

```json
{
  "title": "$18,000 storefront transformation",
  "persona": "Houston restaurant/franchise owner",
  "objective": "qualified profile visits + quote inquiries",
  "format": "before_after_price",
  "hook_family": "price",
  "product": "channel_letters",
  "industry": "restaurant",
  "length_target_seconds": 21,
  "learning_question": "Does stating project price in first 3 seconds increase qualified engagement?"
}
```

## Step 4 — Candidate scoring

Score 0–100:

```text
25 Commercial relevance
20 Historical HSC evidence
15 Visual strength
15 Current format evidence
10 Asset readiness
10 Novel learning value
5 Production ease
```

Hard reject if:

- claim cannot be verified,
- customer media cannot be used,
- content would publicly insult a target/prospect,
- required footage doesn't exist and synthetic replacement would misrepresent a real HSC project,
- concept duplicates a recently rejected post.

## Step 5 — Asset matching

Search the HSC library for the best proof.

Priority order:

1. real HSC footage/photo,
2. real HSC rendering/drawing,
3. new requested capture task,
4. AI-generated B-roll clearly not presented as project proof.

For missing footage, create a capture task such as:

> "Ace: get 8 seconds of channel-letter lift, 9:16, wide + close-up, no talking."

The system should become a producer, not just an editor.

## Step 6 — Script / storyboard

Output:

- exact first-frame hook,
- shot-by-shot timeline,
- voiceover,
- on-screen text,
- caption,
- CTA,
- audio guidance,
- cover frame,
- platform-specific changes.

Keep the copy native and specific. Avoid generic AI phrases such as "transform your brand" unless evidence shows the phrase is intentionally used.

## Step 7 — Generate/edit media

V1 may use an external creation layer (e.g. DoubleSpeed or another approved provider) rather than building a renderer from scratch.

Capabilities required:

- image generation / image-to-image,
- optional video generation,
- text overlays,
- carousel composition,
- preview render,
- music/audio attachment,
- TikTok/Instagram destination selection,
- draft/queue state.

Real HSC media must remain recognizable and should not be altered in a way that changes factual project details.

## Step 8 — Agent self-review

Before human review, the model must inspect the final render and score:

- first-frame clarity,
- text safe zones,
- text legibility,
- visual authenticity,
- pacing,
- factual accuracy,
- HSC brand fit,
- platform nativeness,
- CTA strength,
- obvious AI artifacts.

A visual draft that fails any critical criterion must be regenerated or marked `NEEDS_REVIEW`.

## Step 9 — Human approval

Review card contains:

- preview,
- why agent chose it,
- sources/inspiration,
- all factual claims,
- platform(s),
- scheduled day,
- predicted score,
- experiment variable,
- `Approve`, `Edit`, `Reject`, `Request Alternative`.

Default behavior is draft-only. No auto-publish in v1.

## Step 10 — Publish / queue

On approval:

- create/queue platform-specific post,
- store provider IDs and public URL when available,
- emit `social.post.queued` and later `social.post.published`.

## Step 11 — Measure

Snapshots at:

- +2h,
- +24h,
- +72h,
- +7d.

Normalize metrics by account/platform and post age.

## Step 12 — Write learnings

PB19 should not write vague notes like "before/afters work."

Write structured observations:

```json
{
  "observation": "Price hook + restaurant before/after generated 2.1x baseline save/share rate",
  "sampleSize": 3,
  "confidence": 0.68,
  "dimensions": ["hook:price","format:before_after","industry:restaurant"],
  "recommendedAction": "run 2 additional price-hook reps with different product types"
}
```

Hand this to PB21.

---

# 7. ViralBench-Derived Design Principles

PB19 should deliberately copy these architectural ideas from ViralBench:

1. **Stats injected before research.** The agent starts with its own recent performance.
2. **Bounded rounds.** A run cannot research forever.
3. **Expensive research budget.** Limit external intelligence calls and force action.
4. **View real examples.** Research URLs should be visually inspected, not summarized only.
5. **Reference-based generation.** Prefer authentic/reference media over unconstrained generation.
6. **Preview before publish.** The same agent must inspect its rendered output.
7. **Draft-first safety.** Publishing can stop at a reviewable draft.
8. **Run-to-run memory.** Persist structured learnings, not giant raw chat histories.
9. **Agent chooses strategy; tools perform execution.** Keep tool contracts narrow.
10. **Feedback loop.** Future runs receive actual post metrics.

HSC modifications:

- multi-objective commercial reward instead of views,
- a persistent database rather than local JSON only,
- human approval,
- HSC asset grounding,
- downstream CRM/conversation linkage,
- PB21 experiment layer.

---

# 8. Data Model Additions

```ts
type SocialPost = {
  id: string;
  platform: 'instagram'|'tiktok';
  providerPostId?: string;
  publicUrl?: string;
  status: 'draft'|'approved'|'queued'|'published'|'failed'|'deleted';
  contentExperimentId: string;
  projectIds: string[];
  accountIds: string[];
  assetIds: string[];
  caption: string;
  publishedAt?: string;
  approvalId?: string;
}

type ContentExperiment = {
  id: string;
  hypothesis: string;
  targetPersona: string;
  objective: string;
  genome: SocialContentGenome;
  sourceEvidenceIds: string[];
  predictedScore?: number;
  outcomeScore?: number;
  status: 'candidate'|'approved'|'run'|'measured'|'invalid';
}

type SocialContentGenome = {
  format: string;
  hookFamily: string;
  industry?: string;
  product?: string;
  proofType?: string;
  humanPresence?: string;
  lengthBucket?: string;
  ctaFamily?: string;
  editingStyle?: string;
  audioType?: string;
  geography?: string;
}

type SocialMetricSnapshot = {
  postId: string;
  capturedAt: string;
  ageHours: number;
  views?: number;
  reach?: number;
  avgWatchSeconds?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profileActions?: number;
  follows?: number;
  linkActions?: number;
  conversationCount?: number;
  qualifiedLeadCount?: number;
  pipelineValue?: number;
  wonRevenue?: number;
  source: string;
}
```

---

# 9. UI Requirements

## Social Command Center

Top strip:

- Views / reach
- Qualified engagements
- Conversations
- Leads
- Pipeline
- Won revenue

Sections:

1. **Needs Review** — post drafts waiting for approval.
2. **Today's Agent Plan** — research, create, publish, measurement actions.
3. **What's Working** — PB21 findings.
4. **Content Queue** — drafts/scheduled/published.
5. **Experiments** — active hypotheses.
6. **Asset Gaps** — filming/capture requests.
7. **Recent Performance** — platform-normalized leaderboard.

## Draft Review

Above fold:

- phone preview,
- target persona,
- objective,
- predicted score,
- hypothesis,
- source inspiration.

Side panel:

- script,
- caption,
- genome tags,
- factual claims/evidence,
- assets used,
- edit controls,
- approval actions.

---

# 10. Agent Tool Contract

Recommended v1 tools:

- `get_social_performance`
- `get_creative_learnings`
- `research_social_patterns`
- `view_reference_media`
- `search_hsc_assets`
- `create_capture_task`
- `generate_image`
- `generate_video`
- `compose_post`
- `preview_post`
- `save_social_draft`
- `queue_social_post` (approval token required)
- `get_post_metrics`
- `write_creative_observation`

Each tool must return structured JSON and evidence IDs where applicable.

Do not give the model raw credentials.

---

# 11. Approval Policy

Automatic:

- research,
- analysis,
- asset search,
- idea generation,
- drafts,
- internal previews,
- measurement,
- structured learning.

Human approval required:

- publishing/queueing to HSC accounts in v1,
- using customer-identifiable media with unknown marketing approval,
- mentioning customer/project prices unless verified and approved,
- naming a customer/prospect negatively,
- using synthetic footage that could reasonably be mistaken for completed HSC work.

Future autonomy can be granted per `approved_content_template_id`, not globally.

---

# 12. Events & Handoffs

Emit:

- `social.idea.created`
- `social.draft.created`
- `social.draft.approved`
- `social.post.queued`
- `social.post.published`
- `social.metrics.updated`
- `social.post.high_performer`
- `social.post.engagement_detected`
- `social.learning.created`

Handoffs:

- High performer → PB21.
- Comments/inbound DM → PB20.
- New lead/account discovered → PB09/PB01/PB03/PB04 depending entity type.
- Organic winner suitable for ads → PB21 recommendation to paid workflow/PB18.

---

# 13. Failure Modes / Edge Cases

- Platform metrics arrive late: keep `MEASUREMENT_INCOMPLETE`; don't score prematurely.
- TikTok and Instagram expose different metrics: normalize only comparable fields.
- Trend provider unavailable: fall back to HSC history; do not invent trend claims.
- Asset missing: create filming task instead of filling real-project content with fake proof.
- Post underperforms once: log but don't automatically invalidate format.
- Customer objects to media use: mark all associated assets `customerApprovedForMarketing=false` and unpublish/manual follow-up as appropriate.
- Provider publish fails: preserve draft and retry idempotently.
- Duplicate content: fingerprint hooks/assets/caption and warn before queueing.
- AI generation shows distorted signage/logo/text: fail self-review.

---

# 14. Analytics & Success Criteria

Primary business KPIs:

- qualified social conversations/week,
- qualified leads/week,
- social-sourced pipeline/month,
- social-assisted pipeline/month,
- won revenue from social,
- cost/time per published post.

Creative KPIs:

- median normalized views/reach,
- completion/retention,
- save/share rate,
- qualified comment rate,
- winner rate (% posts >1.5× normalized commercial score),
- time from completed job → published content.

MVP targets after 30 days:

- ≥20 published experiments,
- ≥90% drafts successfully render,
- <10 minutes/day human review time on average,
- 100% posts carry genome metadata,
- 100% material factual claims trace to evidence or explicit human input,
- at least 5 statistically useful creative observations passed to PB21.

---

# 15. Acceptance Criteria

PB19 is MVP-complete when:

1. The system can ingest the last 30 days of posts and metrics from at least one HSC account.
2. It can create a ranked candidate list using performance + HSC assets + optional trend research.
3. It can produce a rendered draft with hook, media, text, caption, CTA, and genome metadata.
4. A user can preview, edit, approve, or reject the draft.
5. Approved content can be queued/published through at least one platform/provider.
6. Metrics are ingested on a schedule after publishing.
7. Results are written into `SocialMetricSnapshot` and linked to `ContentExperiment`.
8. The system creates structured learnings for PB21.
9. No external publish is possible without an approval token in v1.
10. All runs are auditable in the shared Ploybook activity timeline.

---

# 16. Claude Code Implementation Checklist

## Phase A — Data + provider abstraction

- [ ] Add SocialPost, ContentExperiment, SocialMetricSnapshot, SocialAsset, SocialContentGenome.
- [ ] Add platform/provider adapter interface.
- [ ] Add asset search/indexing.
- [ ] Add normalized metrics service.

## Phase B — Agent loop

- [ ] Implement bounded PB19 runner.
- [ ] Inject recent account performance before research.
- [ ] Add research-call budget.
- [ ] Add candidate scoring.
- [ ] Add asset matching.
- [ ] Add draft output schema.
- [ ] Add visual self-review step.

## Phase C — Review + publishing

- [ ] Social Command Center.
- [ ] Draft Review screen.
- [ ] Approval token enforcement.
- [ ] Draft/queue/publish adapter.
- [ ] Public URL/status reconciliation.

## Phase D — measurement

- [ ] +2h/+24h/+72h/+7d metric jobs.
- [ ] Commercial score calculation.
- [ ] PB21 learning event.
- [ ] PB20 engagement event handoff.

---

# 17. Suggested Module Structure

```text
src/social/
  domain/
    social-post.ts
    content-experiment.ts
    content-genome.ts
    social-metrics.ts
  providers/
    publishing-provider.ts
    intelligence-provider.ts
    metrics-provider.ts
  agents/
    content-strategist.ts
    asset-matcher.ts
    script-builder.ts
    visual-reviewer.ts
  services/
    experiment-scorer.ts
    performance-normalizer.ts
    draft-service.ts
  ploybooks/pb19/
    runner.ts
    states.ts
    prompts.ts
    schemas.ts
  ui/
    social-command-center/
    draft-review/
```

---

# 18. Start Prompt for Claude Code

> Read `hsc_growth_os_v1_prd.md`, the shared Ploybook conventions, and this PB19 PRD. Inspect the existing repository before changing architecture. Implement PB19 as a workflow on the shared HSC Growth OS runner, not as a separate app. First build the domain types, provider interfaces, Social Command Center skeleton, and a deterministic mocked Golden Path using one real HSC project asset set. Do not implement auto-publishing until draft creation, preview, approval-token enforcement, metric ingestion, and experiment metadata all work. Treat real HSC media as factual evidence and never synthesize missing project proof. Return a migration plan, changed files, tests, and any unresolved provider/API constraints before proceeding to live credentials.
