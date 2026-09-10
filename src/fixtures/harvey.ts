// Golden fixture #1 (master PRD §34): Harvey Cleary GC pursuit.
// Deterministic stand-ins for live research + LLM calls so PB01/PB05/PB09 test end-to-end
// with zero live connectors (§33.12). Shapes must satisfy the real zod schemas.

export const harveySignalText =
  "Public bid notice: Harvey Cleary Builders is soliciting subcontractor bids for the " +
  "University of Houston Engineering Building project, Houston TX. Scope includes Division 10 " +
  "specialties with exterior signage and wayfinding. Bids due October 2, 2026.";

export const harveySignalParse = {
  company_name: "Harvey Cleary",
  company_type: "general_contractor",
  project_name: "UH Engineering Building",
  project_address: null,
  city: "Houston",
  trade_relevance: "explicit_signage",
  opportunity_type: "gc_bid",
  estimated_construction_value_usd: null,
  estimated_relevance_score: 84,
  why_this_matters:
    "Named GC actively bidding a Houston institutional project with explicit signage/wayfinding scope and a known due date.",
  suggested_ploybook: "pb01_gc_pursuit",
  unknowns: ["bid portal", "estimated signage package value"],
};

export const harveyResearchText =
  "Harvey Cleary Builders (harveycleary.com) is a Houston-headquartered general contractor, " +
  "employee counts reported around 400-600, active across Texas and the Gulf Coast in higher " +
  "education, healthcare, office, and civic work. Current Houston-area activity includes the " +
  "University of Houston Engineering Building (bidding) and multiple medical office projects. " +
  "Preconstruction contacts publicly listed include a Director of Preconstruction (name: Sample " +
  "Precon Lead) and project-level estimators. Subcontractors must enroll in their vendor portal " +
  "and provide COI meeting their insurance minimums; prequalification form required.";

export const harveyBrief = {
  company: {
    summary:
      "Houston-headquartered GC active in higher education, healthcare, office, and civic work across Texas.",
    headquarters: "Houston, TX",
    size: "400-600 employees",
    markets: ["higher education", "healthcare", "office", "civic"],
    houston_presence: "Headquartered in Houston with multiple active local projects.",
  },
  hsc_fit: {
    relevant_products: ["exterior signage", "wayfinding", "monument signs"],
    potential_spend: "recurring signage packages across institutional projects",
    repeatability: "high — repeat GC with steady Houston pipeline",
  },
  people: [
    {
      name: "Sample Precon Lead",
      title: "Director of Preconstruction",
      role_type: "preconstruction",
      why_relevant: "Owns bid-list decisions for the UH project",
      status: "inferred",
    },
  ],
  projects: [
    {
      name: "UH Engineering Building",
      location: "Houston, TX",
      stage: "bidding",
      relevance: "Explicit signage/wayfinding scope in the bid notice",
      status: "verified",
    },
  ],
  signals: ["Active UH Engineering Building bid with signage scope, due Oct 2, 2026"],
  recommended_motion: "Request bid access for the signage/wayfinding package via preconstruction.",
  unknowns: [
    "vendor portal enrollment status for HSC",
    "insurance minimums in their prequalification form",
    "estimated signage package value",
  ],
};

export const harveyStakeholderPlan = {
  roles_needed: [
    { role_type: "preconstruction", why: "controls bid list", found: true },
    { role_type: "estimator", why: "owns the signage package pricing", found: false },
    { role_type: "project_manager", why: "post-award relationship", found: false },
  ],
  people: [
    {
      name: "Sample Precon Lead",
      title: "Director of Preconstruction",
      role_type: "preconstruction",
      influence: 80,
      message_angle: "Direct bid-access request referencing the UH signage scope",
      status: "inferred",
    },
  ],
  missing_roles: ["estimator", "project_manager"],
};

export const harveyOutreachDraft = {
  subject: "Signage package — UH Engineering Building bid",
  body:
    "We saw Harvey Cleary is bidding the UH Engineering Building and the notice includes exterior signage and wayfinding. Houston Sign Crafters is a UL-certified sign manufacturer based here in Houston — we fabricate, permit, and install in-house and carry a 5-year warranty. We'd like to bid the signage package. Could you add us to the bid list or point us to the right estimator?",
  alternate_subject: "Houston signage sub for your bid lists",
  alternate_body:
    "We're a Houston-based, UL-certified sign fabricator that permits and installs in-house. We'd like to be on Harvey Cleary's bid list for signage and wayfinding packages. What does your prequalification process look like?",
  target_contact: "Sample Precon Lead",
  rationale: "Project-specific bid-access request to preconstruction, one CTA, verified facts only.",
  word_count: 72,
};
