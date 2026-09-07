# ViralBench Architecture Teardown → HSC PB19 Implementation Map

**Date:** September 7, 2026  
**Repository reviewed:** `JibranK12345/Viral-Bench`  
**Primary file:** `marketing-agent.ts` (~67 KB, intentionally self-contained)  
**Purpose:** Translate ViralBench's working agent architecture into the HSC Social Content Engine without copying its fitness-specific objective or its view-only reward function.

---

# Executive Summary

ViralBench is technically simpler than the product idea sounds—and that is useful.

The open-source implementation is essentially one bounded LLM loop with five tool families:

```text
Performance + prior notes
        ↓
      LLM
        ↓
 ┌───────────────┐
 │ Research      │ Lightreel
 │ Inspect       │ ScrapeCreators + vision
 │ Generate      │ DoubleSpeed image generation
 │ Preview       │ DoubleSpeed renderer
 │ Publish       │ DoubleSpeed draft/queue
 └───────────────┘
        ↓
 Save run note + later post metrics
        ↓
 Next run receives results
```

The clever part is not a complex multi-agent framework. It is the **closed control loop**:

1. inject real recent performance,
2. force the model to research real winning content,
3. let it inspect media visually,
4. let it generate,
5. make it inspect its own finished output,
6. constrain the number of rounds/research calls,
7. publish/draft through a narrow tool,
8. persist a small memory note,
9. repeat twice daily.

For HSC, keep that loop but replace the objective, memory, data model, and toolset.

---

# 1. What the repository actually contains

The repository is deliberately small:

- `marketing-agent.ts` — orchestration, prompts, APIs, OAuth, media retrieval, generation, preview, publish, metrics, memory.
- `README.md` — setup/run instructions.
- `.env.example` — API keys.
- `package.json` — minimal runtime dependencies.
- screenshots/chart.

There is no heavyweight agent framework, vector database, queueing system, or separate orchestration service in the public repo.

That is a design lesson: **don't begin PB19 by building agent infrastructure for its own sake.** HSC already has a shared Growth OS runner; PB19 should remain a thin domain workflow on top of it.

---

# 2. ViralBench configuration layer

At the top of the file, the agent declares:

- model,
- reasoning effort,
- max rounds (`18`),
- max Lightreel calls (`6`),
- image model,
- max images shown to vision,
- number of prior notes to load,
- target social account,
- `AUTO_QUEUE` flag,
- posts per account,
- one explicit `GOAL` string.

## HSC mapping

```ts
type SocialRunConfig = {
  model: string;
  maxRounds: number;
  maxResearchCalls: number;
  maxGenerationsPerCandidate: number;
  platforms: ('instagram'|'tiktok')[];
  maxCandidates: number;
  maxPostsPerPlatformPerDay: number;
  approvalMode: 'always'|'template_based';
  objectiveWeights: CommercialRewardWeights;
}
```

HSC should store these in database/config, not hardcode the account IDs and goal into one file.

### What to copy

Hard budgets. The agent should know it has limited research and generation calls.

### What not to copy

A single "views at all costs" goal.

---

# 3. System prompt architecture

ViralBench's system prompt does several unusually good things.

## It tells the model what it is bad at

The prompt repeatedly tells the model not to rely on generic training-data intuition about hooks/culture and to lean on current research and real posts.

**HSC equivalent:**

> Do not invent claims about HSC projects, pricing, customers, local permitting, or current social trends. Use verified HSC project data, the asset library, and current research.

## It separates strategy from craft

ViralBench effectively says: be creative in strategy, but ground wording/structure in current evidence.

**HSC equivalent:**

Let the model choose:

- target persona,
- content thesis,
- experiment,
- asset selection,
- when to repeat/pivot.

Constrain:

- factual project claims,
- customer identity,
- prices,
- brand rules,
- platform eligibility.

## It explains noisy distribution

The prompt explicitly warns the model that one flop doesn't kill a format.

**HSC equivalent:** PB21 should enforce minimum reps/sample-size rather than leaving this only as prose.

---

# 4. Main loop

The core `runHarness()` flow is conceptually:

```ts
initialize publishing client
load style presets
fetch account posts
refresh recent metrics
load past notes
build current-stats block
build messages = [system, user(stats + notes)]

for round in 1..MAX_ROUNDS:
  response = LLM(messages)
  parse JSON

  if finish:
    save answer + note
    break

  validate actions
  enforce research-call budget
  run actions (parallel where possible)
  append tool results + images to history

save snapshot
```

This is the core pattern to copy.

## HSC PB19 loop

```ts
load recent normalized performance
load PB21 active learnings + open experiments
load eligible HSC assets / new project signals
load prior run structured memory

for round in bounded run:
  strategist decides one of:
    research
    inspect_reference
    search_assets
    request_capture
    generate
    compose
    preview
    save_draft
    finish

  policy service validates action
  execute tools
  append evidence/results

create Review Queue entries
```

**Important:** Publishing should not happen inside the free-running content-strategy loop in v1. The loop terminates at `save_draft`; an approval event later calls `queue_social_post`.

This is safer and makes async review natural.

---

# 5. Tool 1 — `call_lightreel_api`

ViralBench uses a small HTTP wrapper that sends a natural-language research question plus optional structured response fields. The system prompt strongly encourages rich research questions and limits calls to one per round and six per run.

## Why it works

The model cannot burn 50 cheap searches and drown itself. Research is a scarce resource.

## HSC adaptation

`research_social_patterns` should accept:

```ts
{
  question: string,
  categories: string[],
  lookbackDays: number,
  requestedFields: [...]
}
```

Required return:

- URL/source,
- platform,
- post date if known,
- hook,
- format/structure,
- views/engagement if available,
- why relevant to HSC,
- evidence timestamp.

### Research query families for HSC

- local service transformations,
- construction/install content,
- restaurant openings,
- automotive/detailing before-after,
- home-service price reveals,
- manufacturing process,
- business-owner education,
- signage/awning competitors.

Do not restrict research to sign shops. Adjacent industries may have much better creative craft.

---

# 6. Tool 2 — `view_media`

ViralBench resolves TikTok/Instagram URLs through ScrapeCreators, extracts carousel slides or video cover frames, downsizes images, labels them `T1`, `T2`, etc., and feeds those images back to the same vision-capable model.

This matters because the model sees the actual composition instead of only receiving another model's summary.

## HSC adaptation

Two inspection modes:

### Reference media

`view_reference_media(urls)`

Used to inspect public inspiration.

### HSC asset media

`view_hsc_assets(assetIds)`

Used to inspect actual project footage before writing the edit.

For HSC, asset viewing is more important than AI image generation because physical proof is the brand advantage.

---

# 7. Tool 3 — `generate_image`

ViralBench stores image labels (`G1`, `G2`) and can generate from a prior reference. The prompt strongly favors image-to-image for realism and cross-slide consistency.

## HSC adaptation

AI generation should have three roles:

1. non-project B-roll,
2. concept/mockup/supporting visuals,
3. graphic/carousel treatments.

It should **not** silently replace missing real job footage with a synthetic "HSC project."

Recommended tool contract:

```ts
{
  prompt,
  purpose: 'broll'|'graphic'|'concept',
  referenceAssetId?,
  cannotRepresentAsCompletedHscWork: true
}
```

---

# 8. Tool 4 — `preview_slideshow`

ViralBench constructs a 1080×1920 scene with image + text blocks, calls a render tool, and feeds rendered PNGs back to the model.

This is one of the strongest design choices in the repo.

The model does not approve an abstract JSON description. It sees what the audience will see.

## HSC adaptation

Every content type should have a preview artifact:

- carousel → rendered slides,
- Reel/TikTok → proxy video or storyboard render,
- talking-head script → teleprompter/storyboard preview if full video isn't generated,
- thumbnail/cover → final raster.

A `visual-reviewer` agent/model checks:

- logo/sign distortion,
- unreadable text,
- safe zones,
- pacing,
- first-frame strength,
- customer-identifiable content,
- brand accuracy.

---

# 9. Tool 5 — `publish_slideshow`

ViralBench validates slide URLs, composes the scene, creates a DoubleSpeed draft, gets a review link, and only schedules when `AUTO_QUEUE=true`.

The public README explicitly defaults `AUTO_QUEUE=false`, which means the agent creates a reviewable draft rather than auto-posting.

## HSC adaptation

Keep draft-first as the core design.

```text
PB19 run
  ↓
save_social_draft
  ↓
Approval entity
  ↓
queue_social_post
  ↓
provider status reconciliation
```

Do not give the content agent a raw publish credential that bypasses approvals.

---

# 10. Performance ingestion

ViralBench retrieves prior posts from DoubleSpeed and enriches recent TikTok metrics through ScrapeCreators. It injects a compact list of recent posts and real views/likes/comments/shares/saves into the next run.

## HSC adaptation

Do this with a normalized `SocialMetricSnapshot` service.

The agent's opening context should not be a giant analytics export. Give it:

```text
Account baseline
Last 10 posts
Current experiments
Top/bottom 3 normalized performers
Qualified engagements
Pipeline/revenue outcomes
Data-quality warnings
```

PB21 performs deep analytics; PB19 receives just enough to choose the next creative action.

---

# 11. Memory

ViralBench saves up to 30 run snapshots in `.marketing-agent-runs.json` and loads the most recent notes back into future runs. The prompt says those notes are the only preserved memory.

This is deliberately cheap and effective.

## HSC adaptation

Do not save free-form memory as the primary system.

Persist:

- `CreativeLearning`,
- `ContentExperiment`,
- `SocialMetricSnapshot`,
- rejected concepts,
- approved templates,
- factual brand/project context.

A short `runReflection` may still exist, but PB21 structured learning is the durable memory.

---

# 12. JSON action protocol

ViralBench asks the model to return either:

```json
{"actions":[...]}
```

or a final answer/note. It then parses and dispatches those actions.

This is effectively a homegrown tool-calling protocol.

## HSC adaptation

Since HSC Growth OS already has a shared Ploybook runner, use typed tool calls directly if available. But keep the same conceptual properties:

- narrow actions,
- machine validation,
- server-side policy,
- idempotency,
- returned evidence,
- tool results appended to the run context.

Do not put policy enforcement only in prompt text.

---

# 13. Concurrency

ViralBench runs multiple non-research actions with `Promise.all`, while restricting Lightreel to one call per round.

## HSC adaptation

Safe parallel work:

- search multiple asset types,
- generate multiple hook candidates,
- render multiple variants,
- inspect multiple references.

Do not parallelize stateful operations that race on:

- approval,
- publish status,
- same draft/version,
- CRM entity creation without idempotency.

---

# 14. Error handling

The repo includes practical guardrails:

- retry model calls,
- invalid JSON repair instruction,
- unusable image detection,
- per-account post limits,
- auth token refresh,
- gracefully missing external metrics,
- research budget exhaustion,
- publish draft even if music extraction fails.

## HSC adaptation

Use explicit failure states rather than letting the agent improvise around broken integrations.

Examples:

- `TREND_PROVIDER_UNAVAILABLE`
- `ASSET_PERMISSION_UNKNOWN`
- `PUBLISH_PROVIDER_FAILED`
- `METRICS_DELAYED`
- `CLAIM_NOT_VERIFIED`

A model should never solve `CLAIM_NOT_VERIFIED` by making up the claim.

---

# 15. What to copy exactly at the design level

| ViralBench pattern | HSC implementation |
|---|---|
| Start with current stats | Start PB19 with normalized HSC performance + PB21 learnings |
| Max 18 iterations | Bounded run, configurable 12–18 rounds |
| Max 6 intelligence calls | Research budget 3–6/run |
| Real post URLs | Evidence-backed reference media |
| Vision inspection | Inspect both references and HSC assets |
| Reference image generation | Reference-first graphics/B-roll |
| Render and see output | Visual self-review before human review |
| Draft by default | Approval entity before queue |
| Run note memory | Structured PB21 CreativeLearning + small reflection |
| Twice-daily loop | Morning creation + afternoon measurement |
| Views objective | HSC commercial reward function |

---

# 16. What not to copy

## A. Fitness-specific "copy the exact words" prompt

HSC should learn mechanisms/structures, not plagiarize creator copy.

## B. Views-only objective

Can produce irrelevant rage bait.

## C. Single local JSON memory

Not enough for an integrated Growth OS.

## D. One-account hardcoding

HSC needs platform/account/provider abstractions.

## E. Publishing inside the unconstrained agent loop

Draft during loop; approval publishes.

## F. AI-first visuals

HSC's real physical work is stronger proof than synthetic media.

---

# 17. PB19 Golden Path modeled on ViralBench

```text
07:00 Run starts

1. get_social_performance
   → last 10 posts + baselines + qualified outcomes

2. get_creative_learnings
   → "restaurant transformations strong; price hook hypothesis open"

3. research_social_patterns
   → real current transformation/price content

4. view_reference_media
   → inspect 3 complete examples

5. search_hsc_assets
   → find a real restaurant project with before/install/night reveal

6. compose candidate
   → 21s Reel, price hook, real HSC footage

7. preview_post
   → rendered proxy

8. visual self-review
   → text too low; change safe-zone position

9. preview_post again
   → passes

10. save_social_draft
   → creates approval card

11. finish run + structured reflection

Rameel approves

12. queue_social_post

+2h/+24h/+72h

13. metrics ingested
14. PB20 engagement outcomes linked
15. PB21 updates hypothesis
```

This is the architecture to build.

---

# 18. Recommended implementation sequence

### Day 1

Social domain model + mocked provider + one deterministic experiment.

### Day 2

Performance injection + Asset Library search.

### Day 3

Research + reference-media inspection.

### Day 4

Draft composition + preview + visual review.

### Day 5

Approval + live draft publishing provider.

### Day 6

Metrics reconciliation.

### Day 7

PB21 learning handoff.

Do not begin with Instagram DMs, multi-account persona farming, or autonomous publishing. Prove that the closed content loop can produce one useful HSC post per day first.

---

# 19. Source Notes

Reviewed September 7, 2026:

- https://github.com/JibranK12345/Viral-Bench
- https://www.viralbench.ai/
- https://docs.doublespeed.ai/

The public ViralBench site describes a twice-daily, maximum-18-iteration loop with five tools: Lightreel research, media viewing, image generation, slideshow preview, and publishing. The GitHub code adds recent-post performance injection, limited research calls, visual references, draft/queue behavior, and local run-note memory.
