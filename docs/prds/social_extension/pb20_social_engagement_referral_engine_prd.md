# PB20 — Social Engagement & Referral Engine

**Product:** HSC Growth OS v1  
**Ploybook:** PB20  
**Owner:** Houston Sign Crafters Growth / Sales  
**Primary user:** Rameel / HSC sales team  
**Version:** 1.0  
**Date:** September 7, 2026  
**Target:** MVP during September 2026  
**Status:** Build-ready  
**Parent spec:** `hsc_growth_os_v1_prd.md`  
**Depends on:** PB19 Social Content Engine, PB09 Account Research Brief, shared CRM/entity graph  
**Feeds:** PB01/PB03/PB04/PB06/PB09 depending qualified entity; PB21 for engagement-quality learning

---

# 1. Purpose

Convert legitimate social interactions around HSC content and ads into qualified conversations, referrals, and commercial opportunities without turning the account into a spam bot.

PB20 is the monetization layer behind PB19. PB19 earns attention; PB20 detects high-intent engagement, enriches the person/company when permitted, chooses the correct response path, drafts contextual outreach, and writes qualified opportunities into HSC Growth OS.

## Critical platform constraint

The original idea—"DM accounts who liked a post"—cannot be implemented end-to-end using Meta's official Instagram Messaging API. Official Instagram conversations generally require the recipient to have messaged the professional account first. Meta does provide a special **private reply to a commenter**: one private message can be sent based on a comment within seven days; follow-up messaging requires the recipient to respond and then follows the normal messaging window.

Therefore v1 must distinguish:

### Officially automatable triggers

- comment on HSC Instagram content/ad,
- inbound Instagram DM,
- story mention/reply that creates a conversation,
- supported lead/message ad interaction,
- TikTok/Instagram comments if provider/API permits compliant retrieval/reply,
- CRM/website conversion linked to social.

### Not an official cold-DM trigger

- a simple Instagram like from an arbitrary consumer account.

Likes can contribute to aggregate creative performance. If HSC later uses a third-party public-data provider to surface visible likers, PB20 may create a **manual research/outreach suggestion**, but the system must not pretend the official Instagram API supports programmatic cold messaging to those accounts.

---

# 2. Goals

- Detect commercially meaningful social interactions quickly.
- Separate buyer/referral intent from noise.
- Research qualifying business accounts using PB09.
- Draft replies/DMs that reference the actual interaction and HSC context.
- Use comment-private-reply flows where supported.
- Convert qualified conversations into Contact, Account, Opportunity, and Relationship records.
- Measure social conversations → pipeline → revenue.
- Learn which content types produce commercially useful engagers, not just engagement volume.

## Non-Goals

- Mass-DMing likers/followers.
- Unofficial browser automation designed to bypass platform messaging restrictions.
- Auto-sending a sales pitch to every comment.
- Enriching or storing unnecessary personal/sensitive attributes.
- Fabricating company associations from a username.
- Treating emoji comments as leads without evidence.

---

# 3. Trigger Types

## A. Comments

Examples:

- "How much was this?"
- "Do you work in Dallas?"
- "My cousin needs a sign."
- "Can you do this for a medical office?"
- "DM me."
- business account comments on a transformation.

## B. Inbound DMs

Any new conversation or response associated with HSC social content.

## C. Story mentions / replies

When surfaced through the connected messaging system.

## D. Ad-message / lead interaction

Meta lead, click-to-message, comment, or other supported event linked to a creative.

## E. High-intent cross-event bundle

Where platform data legitimately exposes it, combine multiple signals such as:

- commenter + profile visit,
- repeat commenter,
- comment + inbound DM,
- comment on multiple project posts,
- existing CRM target engages.

Simple like counts remain creative signals, not outbound-message authorization.

---

# 4. Engagement Classification

Every event is classified into:

```text
BUYER_INTENT
REFERRAL_INTENT
PRICE_QUESTION
SERVICE_AREA_QUESTION
PROJECT_QUESTION
CAPABILITY_QUESTION
SUPPORT_EXISTING_CUSTOMER
POSITIVE_SOCIAL
NEGATIVE_SOCIAL
SPAM_BOT
UNKNOWN
```

## Qualification score (0–100)

```text
30 Explicit commercial intent
20 Business/company fit
15 Geography fit
15 Evidence of physical-location/sign need
10 Relationship / existing target-account value
5 Multi-event engagement
5 Referral-network value
```

### Score bands

- **80–100 — Sales action now**
- **60–79 — Research + review**
- **40–59 — Helpful public response; monitor**
- **0–39 — normal community engagement / ignore / moderate**

Hard override to high priority for explicit quote/project requests.

---

# 5. State Machine

`EVENT_RECEIVED` → `CLASSIFYING` → `QUALIFYING` → (`PUBLIC_REPLY_DRAFT` | `PRIVATE_REPLY_ELIGIBLE` | `INBOUND_CONVERSATION` | `MONITOR_ONLY`) → `RESEARCHING` → `REVIEW` → `SENT/RESPONDED` → `CONVERSATION_OPEN` → `LEAD_QUALIFIED` → `OPPORTUNITY_CREATED` → `OUTCOME_TRACKING`

Alternate:

- `NOT_MESSAGEABLE`
- `EXPIRED_PRIVATE_REPLY_WINDOW`
- `SPAM`
- `NEEDS_HUMAN`
- `CLOSED_NO_OPPORTUNITY`

---

# 6. End-to-End Workflow

## Step 1 — Ingest engagement event

Store:

- platform,
- event type,
- post/ad ID,
- public text if applicable,
- platform-scoped actor ID if legitimately provided,
- username/business metadata if legitimately provided,
- timestamp,
- reply/messaging eligibility,
- source creative experiment.

Never infer that a person can be messaged simply because their public username is known.

## Step 2 — Classify intent

Use rules first for obvious cases, model second.

Examples:

"price?" → PRICE_QUESTION  
"do you install in Austin" → SERVICE_AREA_QUESTION  
"my restaurant needs this" → BUYER_INTENT  
"my brother opens next month" → REFERRAL_INTENT

The model outputs evidence snippets from the interaction.

## Step 3 — Decide response path

### Public-only

Use when:

- generic compliment,
- useful FAQ,
- no reason for private sales outreach.

### Private reply to comment

Use only if the API reports eligibility and event is within the platform window.

Good use:

> "Can you send pricing?"

The public reply can answer enough to be useful; the private reply can invite project details.

### Existing/inbound conversation

If the user has already initiated a DM, the agent can draft messages within the permitted conversation context/window.

### Manual opportunity

If a high-value business account is visible but not messageable through official API, create:

> `Manual relationship action — review account and choose human outreach channel.`

Potential paths: follow, public reply, contact via business email/website/Apollo, or no action.

This is where a visible liker discovered by a third-party provider would land—not in an automated DM queue.

## Step 4 — Enrich only when commercial signal warrants it

If score ≥60, call PB09 with the exact visible company/username information.

Research:

- company,
- role if public/professional,
- Houston/Texas presence,
- locations,
- expansion signal,
- CRM match,
- existing relationship,
- relevant project.

Do not guess identity from weak handle similarity.

## Step 5 — Draft response

Response should be short, conversational, and contextual.

### Price question

Public:

> "This one was about $X installed. Size, lighting, permitting and install access move the number a lot."

Private if eligible:

> "Saw your comment on the restaurant sign. If you send the storefront + logo, I can tell you pretty quickly what range you're in."

### Referral intent

> "Appreciate it. If they're in Texas, send me the business/location and I'll make sure we take care of them."

### Business engager, no explicit need

Do **not** force a DM. Create relationship suggestion if account is valuable.

## Step 6 — Human approval policy

V1:

- routine public FAQ response can optionally be auto-approved from a whitelisted template later,
- all sales-oriented private replies/DM drafts require approval,
- any message involving pricing beyond verified public range requires approval,
- any referral incentive mention requires current approved referral-program terms.

## Step 7 — Conversation qualification

If person replies, agent collects minimal information:

- business/company,
- location,
- sign/product need,
- timing,
- approximate project stage,
- preferred contact information if voluntarily provided.

Do not turn an Instagram conversation into a 12-question bot interrogation.

Target:

> get enough context to move to HSC's normal sales process.

## Step 8 — CRM creation

When threshold met:

- resolve/create Contact,
- resolve/create Account,
- create Opportunity,
- source = social,
- source post/ad = exact creative,
- original interaction preserved,
- social platform IDs stored in connector-scoped fields,
- run appropriate child Ploybook.

Examples:

Restaurant owner opening second location → PB03 Franchise Expansion if chain/multi-location, otherwise standard Opportunity.  
GC/developer → PB01/PB02.  
Facilities portfolio → PB04.

## Step 9 — Referral tracking

For true referral intent:

```text
Engager/referrer
   ↓
Referral intro
   ↓
Referred account/contact
   ↓
Opportunity
   ↓
Won revenue
```

Never award a referral payout from a social comment alone. Follow HSC's current referral rules and payment process.

## Step 10 — outcome feedback

PB21 receives:

- content experiment,
- number of qualified engagements,
- conversations,
- opportunities,
- pipeline,
- revenue.

This allows PB21 to discover that a 9k-view post can be more valuable than a 200k-view post.

---

# 7. Like-Engager Strategy Without Pretending the API Can DM Them

The original intuition is still useful.

## Official data path

Treat likes primarily as:

- post-quality signal,
- audience resonance signal,
- input to PB21.

## Optional public-data enrichment path

A separate provider may expose a subset/list of publicly visible likers. If HSC chooses to use such a provider, the workflow is:

`visible liker → public professional profile classification → company-fit score → manual relationship suggestion`

NOT:

`visible liker → automated Instagram cold DM`.

For high-value profiles, safer commercial actions include:

- include company in account research,
- follow/engage naturally,
- use legitimate business email/contact channels,
- retarget through paid audiences when platform-supported,
- wait for a comment/inbound DM.

This keeps PB20 useful even if the platform closes or changes public-data surfaces.

---

# 8. Data Model Additions

```ts
type SocialEngagementEvent = {
  id: string;
  platform: 'instagram'|'tiktok'|'facebook';
  eventType: 'comment'|'dm'|'story_mention'|'story_reply'|'ad_message'|'lead'|'like_aggregate'|'other';
  socialPostId?: string;
  adCreativeId?: string;
  actorScopedId?: string;
  actorUsername?: string;
  text?: string;
  occurredAt: string;
  messageEligibility: 'private_reply'|'existing_conversation'|'not_messageable'|'unknown';
  eligibilityExpiresAt?: string;
  sourceEvidenceId: string;
}

type SocialEngagementQualification = {
  eventId: string;
  intent: string;
  score: number;
  companyFit?: number;
  geographyFit?: number;
  reasons: string[];
  accountId?: string;
  contactId?: string;
  recommendedPath: string;
}

type SocialConversation = {
  id: string;
  platform: string;
  platformThreadId?: string;
  accountId?: string;
  contactId?: string;
  sourceEventId: string;
  sourcePostId?: string;
  status: 'draft_pending'|'open'|'qualified'|'closed'|'blocked';
  lastInboundAt?: string;
  messagingWindowEndsAt?: string;
}
```

---

# 9. UI Requirements

## Social Engagement Inbox

Tabs:

- Needs reply
- High intent
- Referral
- Research required
- Monitoring
- Closed

Card:

```text
87 HIGH INTENT
@houstoncoffeeowner
Commented on: $18k storefront transformation
"Need something like this for our Richmond location"

Company: Houston Coffee Co. (matched)
Locations: 3
CRM: new
Message eligibility: Private reply available until Sep 12

Recommended:
Reply publicly + send private reply asking for storefront/logo.

[Review reply] [Create opportunity] [Dismiss]
```

For not-messageable actor:

```text
72 ACCOUNT FIT
Visible public engagement
Instagram DM not permitted through connected API.

[Research account] [Add manual relationship task] [Ignore]
```

Never display a fake `Send DM` button when API policy does not allow it.

---

# 10. Agent Tool Contract

- `get_social_engagement_events`
- `classify_social_engagement`
- `check_messaging_eligibility`
- `get_comment_context`
- `research_account` → PB09
- `draft_public_reply`
- `draft_private_reply`
- `send_public_reply` (approval as configured)
- `send_private_reply` (approval token required in v1)
- `get_conversation`
- `create_social_lead`
- `create_referral_relationship`
- `launch_child_ploybook`

Provider adapters must enforce platform eligibility server-side. The model may not override it.

---

# 11. Messaging Guardrails

- Never send to a user merely because they liked a post.
- Never manufacture a conversation state.
- Never send repeated private replies to one comment.
- Never continue automated follow-ups outside provider-reported messaging eligibility.
- Never scrape/store sensitive personal information for lead scoring.
- Never claim an account owns a company without sufficient evidence.
- Respect opt-outs immediately.
- Rate limits and per-recipient limits must be enforced outside the LLM.
- Keep messages short; avoid multi-paragraph cold pitches.

---

# 12. Events & Handoffs

Emit:

- `social.engagement.received`
- `social.engagement.qualified`
- `social.reply.drafted`
- `social.reply.sent`
- `social.conversation.opened`
- `social.lead.qualified`
- `social.referral.created`
- `social.opportunity.created`
- `social.engagement.outcome.updated`

Child Ploybooks selected by entity context.

---

# 13. Analytics

Top-level:

- engaged accounts/events,
- qualified engagement rate,
- median response time,
- conversations created,
- conversation → qualified lead,
- qualified lead → opportunity,
- social pipeline,
- won revenue,
- referrals created,
- revenue per 1,000 views by content genome.

Track messages by source type so comment-private-reply performance is not mixed with inbound DMs.

---

# 14. Acceptance Criteria

1. PB20 ingests at least Instagram comments and inbound message events from the chosen official/provider integration.
2. Every event carries explicit messaging eligibility.
3. The UI never offers automated cold DM to a simple liker.
4. Eligible comments can generate a private-reply draft linked to the source comment.
5. High-fit business engagement can launch PB09 research.
6. Human can approve a response and provider adapter sends it only if eligibility remains valid.
7. Reply/inbound conversation can create a Contact/Account/Opportunity without duplicate records.
8. Source post/creative is preserved through opportunity and revenue attribution.
9. Opt-out/block/closed state stops future automation.
10. PB21 can query qualified engagements and pipeline by content experiment.

---

# 15. Claude Code Implementation Checklist

- [ ] Add engagement/conversation schemas.
- [ ] Build Instagram webhook ingestion.
- [ ] Add server-side messaging eligibility function.
- [ ] Add comment-private-reply deadline handling.
- [ ] Add intent classifier + deterministic rules.
- [ ] Integrate PB09 account research.
- [ ] Build Social Engagement Inbox.
- [ ] Add draft/approval/send pipeline.
- [ ] Add CRM entity resolution + social attribution.
- [ ] Add referral relationship record.
- [ ] Add opt-out / blocked recipient state.
- [ ] Add PB21 outcome event.

---

# 16. Start Prompt for Claude Code

> Implement PB20 only after reading the master HSC Growth OS PRD and PB19. Treat platform messaging eligibility as a hard server-side constraint, not a prompt instruction. In v1, support comments, eligible private replies, inbound conversations, and CRM conversion. Do not build an automated 'DM likers' path: Meta's official messaging model does not authorize cold DMs from likes. If a third-party public-data liker source is later added, surface those profiles only as research/manual relationship suggestions. Build the Golden Path: Instagram comment expressing project intent → classify → check private-reply eligibility → PB09 company research → draft public/private reply → human approval → send → inbound response → create HSC opportunity with source-post attribution.
