// Team-facing usage guide — single source of truth, rendered on /guide and as
// the "How to use this" expander on each Ploybook card. Plain English (house
// style): front-load the point, short sentences, no jargon, no invented claims.

export interface PloybookGuide {
  key: string;
  title: string;
  audience: string;
  whenToUse: string;
  whatToEnter: string;
  whatHappens: string;
  whatYouGet: string;
  goodExample?: string;
  caveat?: string;
}

export const GENERAL_GUIDE = {
  intro:
    "Growth OS is a funnel: Opportunities (everything found, unreviewed) → Pursue → Researched (briefs and contacts, ready to act on). It never sends an email, publishes a page, or submits a bid on its own — you review and fire every external action yourself.",
  rhythm: [
    "Every morning the system pulls new construction filings (TDLR, 39 counties around Houston), Houston certificates of occupancy (businesses moving in), a web scan for franchise expansions and developments, and any PlanHub bid invites forwarded from email — all scored into Opportunities. That tab is the triage inbox: everything unreviewed, best first.",
    "On a normal card, Pursue starts the research: who's behind it, contacts, fit (~5 minutes). On an incoming bid invite the button says 'Bid this' — clicking it means we're bidding, and the bid moves to Researched → Bids Interested In. Dismiss drops a card for good.",
    "High scorers (75+) don't wait for a click — they research themselves, best first, up to a daily budget. Finished research lands in Researched either way.",
    "Researched → Researched Opportunities is where you act: each card has the brief, contacts, and website, plus three buttons — Write email (finds the contact's address and drafts in Ray's voice; you edit and send), Company swarm (drafts to several people at the company), and ABM page (a personalized sales page).",
    "Researched → Bids Interested In is the bid desk: upload the plans zip for an estimator brief, Run QA before submitting, Mark submitted (starts automatic Day-2/7/14/30 follow-up drafts), then We won / We lost.",
    "Long jobs run in the background for a few minutes. Refresh the page; Ploybooks → Recent runs shows progress.",
  ],
  scores:
    "Scores are 0–100 and answer one question: how likely is this to become good sign work for us? Blue 85+ means pursue now. Dark 70–84 is strong. Amber 50–69 means monitor. Below 50, ignore unless you know something the system doesn't. Canopy/awning work counts statewide; signage-only work counts within ~150 miles of Houston.",
  approvals:
    "Emails never send themselves. Write email puts an editable draft on the researched card — what's in the fields when you approve (with a verified recipient) is exactly what sends, as Ray. Discarding a draft keeps the research.",
};

// (appended below via PLOYBOOK_GUIDES entries pb16–pb18)
export const PLOYBOOK_GUIDES: Record<string, PloybookGuide> = {
  pb00_dummy: {
    key: "pb00_dummy",
    title: "Engine smoke test",
    audience: "Nobody — it's a system check",
    whenToUse: "Only to check the system is alive. It creates throwaway test records.",
    whatToEnter: "Nothing.",
    whatHappens: "A fake account and opportunity are created, then it asks for one approval.",
    whatYouGet: "Proof the engine works. Safe to ignore day to day.",
  },
  pb01_gc_pursuit: {
    key: "pb01_gc_pursuit",
    title: "Go after a general contractor",
    audience: "Rameel, sales",
    whenToUse:
      "A GC is bidding a project that includes signs or awnings, or you want HSC on a GC's bid list. Also the 'Pursue' button on most TDLR opportunities runs this.",
    whatToEnter: "The GC's company name. Example: Harvey Cleary.",
    whatHappens:
      "It researches the company live on the web (about 5 minutes), finds the right people, checks what they require from vendors, scores the fit, and writes a short intro email.",
    whatYouGet:
      "A researched card with the brief, the people found, and what's missing. Hit Write email on it when you're ready — the draft appears there for you to edit and send.",
    goodExample: "TDLR shows a $10M Houston project → Pursue → review the brief in Researched → Write email.",
    caveat: "Names found by research are unverified until checked in Apollo or LinkedIn. Never email a guessed address.",
  },
  pb02_commercial_development: {
    key: "pb02_commercial_development",
    title: "Map a new development",
    audience: "Rameel, sales",
    whenToUse:
      "A shopping center, mixed-use, or retail development is announced or under construction and it will need monument, directional, and tenant signage.",
    whatToEnter: "The development's name. Example: Manvel Town Center.",
    whatHappens:
      "It researches who's behind it (developer, GC, architect, property manager) and which tenants are announced, then creates a separate opportunity for each confirmed tenant.",
    whatYouGet:
      "A map of the players, tenant opportunities in the inbox, and a recommendation for who to approach first (usually the developer for the site package).",
    caveat: "Revenue estimates are labeled ASSUMPTION. They are for prioritizing, not for quoting.",
  },
  pb03_franchise_expansion: {
    key: "pb03_franchise_expansion",
    title: "Chase a franchise rollout",
    audience: "Rameel, sales",
    whenToUse: "A brand is opening multiple Texas locations — new market entry, development agreement, or an existing customer expanding.",
    whatToEnter: "The brand name. Example: OAKBERRY.",
    whatHappens:
      "It researches the Texas footprint, announced openings, and who actually buys the buildouts (franchisor, franchisee groups, or their GCs).",
    whatYouGet:
      "Each confirmed opening as an opportunity, a strategic score for the brand, and a recommendation on the buying path — who to contact and with what offer.",
  },
  pb04_facility_portfolio: {
    key: "pb04_facility_portfolio",
    title: "Win a multi-location operator",
    audience: "Rameel, sales",
    whenToUse:
      "One company operates many locations (clinics, gyms, gas stations, restaurants) and could give us repeat signage and service work.",
    whatToEnter: "The operator's name. Example: HCA Houston Healthcare.",
    whatHappens:
      "It researches their locations and facilities/construction people, checks for expansion or rebrand activity, and looks for an existing sign vendor.",
    whatYouGet:
      "A portfolio opportunity with contacts and a pitch recommendation. If they already have a sign vendor, it recommends the overflow/service angle — never 'replace your vendor'.",
  },
  pb05_opportunity_radar: {
    key: "pb05_opportunity_radar",
    title: "Turn any signal into an opportunity",
    audience: "Everyone",
    whenToUse:
      "You saw something — a bid notice, a news article, a permit, a PlanHub invite, an email. Paste it and let the system decide if it matters. TDLR filings run through this automatically every morning.",
    whatToEnter: "The raw text of whatever you saw. More text is better than a summary.",
    whatHappens: "It identifies the company and project, checks it's not already in the system, scores it, and says why it matters.",
    whatYouGet: "A scored card in Opportunities with a recommended next step. Duplicates are caught automatically.",
  },
  pb06_company_swarm: {
    key: "pb06_company_swarm",
    title: "Multi-contact push on one account",
    audience: "Rameel, sales",
    whenToUse:
      "One relationship isn't enough — a strategic account where you want 3–5 people hearing from us over a week or two.",
    whatToEnter: "The account name. If we have no contacts yet, it researches and finds some first.",
    whatHappens:
      "It picks the most influential people, gives each a different angle and a different day, and writes each a different message. Identical messages are blocked by the system.",
    whatYouGet: "One approval card with the whole sequence — people, timing, and every draft. Approve the plan, then send the messages yourself on the scheduled days.",
  },
  pb07_abm_page: {
    key: "pb07_abm_page",
    title: "Private page for one account",
    audience: "Rameel, sales",
    whenToUse:
      "You want to send a prospect a page made just for them — our relevant capabilities and proof, in their language — instead of a generic brochure.",
    whatToEnter: "The account name.",
    whatHappens: "It builds the page from our real research on them. Proof slots are placeholders until you attach real portfolio projects.",
    whatYouGet:
      "A draft page. Approve to publish at a private link (unguessable, hidden from Google). Every time they open it, the visit is logged on the account.",
    caveat: "Attach real project photos before sending. Never send with placeholder proof.",
  },
  pb08_high_intent_visitor: {
    key: "pb08_high_intent_visitor",
    title: "Website visitor → lead",
    audience: "Automatic (RB2B)",
    whenToUse:
      "Runs by itself when RB2B identifies a visitor on our site. Run it manually only to test.",
    whatToEnter: "Nothing normally. Manual runs take a company name.",
    whatHappens:
      "It scores what they looked at — pricing, monument signs, awnings, and proposal pages score high; blog and careers score zero. Repeat visits add points.",
    whatYouGet:
      "High scorers become opportunities with the identified person saved as a contact and a recommended next move. Low scorers are just logged.",
  },
  pb09_account_research: {
    key: "pb09_account_research",
    title: "Research brief on any company",
    audience: "Everyone",
    whenToUse: "You're about to call, meet, or quote someone and want the full picture in one place.",
    whatToEnter: "The company name.",
    whatHappens: "Live web research (about 5 minutes): what they do, size, Houston presence, projects, people, signals.",
    whatYouGet:
      "A structured brief saved on the account. Facts are labeled verified, inferred, or assumed — trust them in that order.",
  },
  pb10_incoming_bid: {
    key: "pb10_incoming_bid",
    title: "Log an incoming bid invite",
    audience: "Jamal",
    whenToUse: "A bid invitation arrives — PlanHub, email, or a phone call you turn into notes.",
    whatToEnter: "Paste the whole invitation text (the email body or PlanHub invite).",
    whatHappens:
      "It extracts the GC, project, due date, and how to submit, creates a tracked bid with an internal deadline two days early, and recommends BID, REVIEW, or PASS.",
    whatYouGet:
      "An approval card with the recommendation. Approve = we're bidding it (Jamal is assigned). Reject = pass, recorded so we remember why.",
    goodExample: "Forwarded C.A. Walker email → paste → REVIEW recommendation → approve → analysis queued.",
  },
  pb11_bid_analyzer: {
    key: "pb11_bid_analyzer",
    title: "Analyze a bid package",
    audience: "Jamal",
    whenToUse: "You've downloaded the drawings, specs, and addenda for a bid and want the estimator brief before doing the takeoff.",
    whatToEnter: "The folder path where the files live.",
    whatHappens:
      "It reads every document (a few minutes), finds the signage/awning/canopy sheets and specs, splits scope into built-in-house vs bought-from-suppliers, flags risks, and drafts supplier price requests immediately — because waiting on supplier pricing is our slowest step.",
    whatYouGet:
      "The estimator brief on the bid card (scope, sheet references, risks, RFIs, exclusions) plus supplier RFQ drafts in Researched — send those day 1, then do the takeoff.",
    caveat:
      "It never invents quantities — measuring stays your job. Easiest way to run it: zip the downloaded package and use 'Upload + analyze' on the Bids page.",
  },
  pb12_bid_qa: {
    key: "pb12_bid_qa",
    title: "Pre-submission checklist",
    audience: "Jamal",
    whenToUse: "The bid is priced and you're about to submit. Run this first — it catches the boring mistakes that lose bids.",
    whatToEnter: "The bid's ID (shown on the PB10 run and the approval card).",
    whatHappens:
      "It checks 16 items — addenda acknowledged, supplier quotes received, W-9, COI, signature, the deadline hasn't passed — and says READY or NOT READY with the blockers.",
    whatYouGet:
      "A checklist card under the bid in Researched → Bids Interested In. Submit the bid yourself (portal or email), then hit Mark submitted on the bid card — that starts the follow-up plan automatically.",
  },
  pb13_bid_followup: {
    key: "pb13_bid_followup",
    title: "Bid follow-up (automatic)",
    audience: "Jamal, sales",
    whenToUse:
      "You don't run this — it starts by itself when a bid is recorded as submitted. Day 2, 7, 14, and 30 follow-ups are scheduled automatically.",
    whatToEnter: "Nothing normally. Manual runs take a bid ID.",
    whatHappens:
      "When a follow-up comes due, a short drafted email appears in Researched (with the bid). The day-30 one asks about the award — and if we lost, who won. Once the bid is marked won or lost, remaining follow-ups cancel themselves.",
    whatYouGet: "No bid ever goes silent. Approve each draft after you send it.",
  },
  pb14_deal_room: {
    key: "pb14_deal_room",
    title: "Trackable proposal page",
    audience: "Rameel, sales",
    whenToUse:
      "Instead of emailing a static proposal PDF, give the customer a private page — and know when they read it.",
    whatToEnter: "The opportunity's ID (from its card or run).",
    whatHappens:
      "It drafts the page from our real research: scope, process timeline, warranty, exclusions, FAQs. Pricing stays blank until a person enters it — the system never prices anything.",
    whatYouGet:
      "Approve to publish at a private link. Every view is logged, and 3+ views in 24 hours raises a 'call them now' alert.",
  },
  pb16_local_seo: {
    key: "pb16_local_seo",
    title: "Build a city + product page",
    audience: "Rameel",
    whenToUse:
      "We're getting demand from a suburb we don't have a page for — like monument signs in Richmond — and want to rank there.",
    whatToEnter: "City × Product. Example: Richmond × Monument Signs.",
    whatHappens:
      "It first checks the live site — if a page already covers it, it stops and says so instead of creating a near-duplicate. Then it researches real local facts and writes a 1,000+ word draft where every local claim carries a source.",
    whatYouGet:
      "A publish-ready draft in Researched (bottom section), with anything unverified listed up top to confirm first. Approving means 'good to publish' — adding it to the website is the next human step.",
    caveat: "Never publish with unconfirmed claims still listed. Thin local research means a shorter local section, not invented color.",
  },
  pb17_content_builder: {
    key: "pb17_content_builder",
    title: "Answer a real customer question",
    audience: "Everyone",
    whenToUse:
      "Customers keep asking the same question, sales keeps hitting the same objection, or you spot a search people make that we don't answer.",
    whatToEnter: "The question in plain words. Example: channel letter cost in Houston.",
    whatHappens:
      "It checks we don't already answer it, researches the real answer, and writes an article that answers the question in the first paragraph. Dollar figures are never invented — anything numeric goes on a confirm-first list.",
    whatYouGet:
      "A 700+ word draft in Researched (bottom section), plus a list of real HSC project examples to attach before publishing.",
  },
  pb18_growth_operator: {
    key: "pb18_growth_operator",
    title: "The daily brief (automatic)",
    audience: "Rameel",
    whenToUse:
      "You don't run this — it runs itself every morning after the day's opportunity pull finishes, and appears at the top of the Home page. Run it manually only if you want a fresh brief later in the day.",
    whatToEnter: "Nothing.",
    whatHappens:
      "It counts what actually happened straight from the database — new opportunities by source, bids, pending approvals, follow-ups waiting, page views — and turns it into plain-English observations and ranked recommendations.",
    whatYouGet:
      "The brief on the Home page. Every recommendation names the playbook to run or the human action to take. The numbers are real; a quiet week says 'quiet week'.",
  },
  pb15_business_case: {
    key: "pb15_business_case",
    title: "Help a champion sell us internally",
    audience: "Rameel",
    whenToUse:
      "A big deal is stuck because your contact has to convince their own bosses. Give them the document that does it.",
    whatToEnter: "The opportunity's ID.",
    whatHappens:
      "It drafts the internal case: current state, proposed model, benefits, an implementation plan — with confirmed facts strictly separated from assumptions, and every dollar figure labeled ASSUMPTION.",
    whatYouGet: "A draft saved on the opportunity. Review it, fill the gaps it lists, and send it to your champion.",
  },
};
