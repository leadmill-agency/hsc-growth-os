// Phase 2 golden fixtures (master PRD §34 + radar PRD §16 seed accounts):
// PB03 OAKBERRY (franchise), PB04 HCA CareNow (facility portfolio),
// PB02 Manvel Town Center (commercial development).

export const oakberryResearchText =
  "OAKBERRY Acai is expanding across Texas through Rand Group International, a Texas master " +
  "franchise operator, with plans reported for nearly 100 stores statewide. Announced openings " +
  "include Houston Heights (under construction) and Katy (lease signed). OAKBERRY uses approved/" +
  "designated suppliers but provides a supplier approval process. Buildouts are handled by the " +
  "franchisee group with standardized inline, endcap, urban, and kiosk store formats.";

export const oakberryProfile = {
  brand_summary: "Acai bowl franchise expanding across Texas via master franchisee Rand Group International.",
  franchisor: "OAKBERRY USA",
  texas_location_count: 6,
  houston_location_count: 3,
  announced_openings: [
    { location_name: "Houston Heights", city: "Houston", state: "TX", stage: "construction", status: "verified", note: "under construction" },
    { location_name: "Katy", city: "Katy", state: "TX", stage: "announced", status: "inferred", note: "lease signed" },
    { location_name: "San Antonio Pearl", city: "San Antonio", state: "TX", stage: null, status: "assumed", note: "rumor only" },
  ],
  franchisee_groups: [
    { name: "Rand Group International", territory: "Texas", status: "verified" },
  ],
  buying_path: "franchisee",
  sign_standards_note: "Brand requires approved suppliers; supplier approval process exists.",
  expansion_velocity: "high",
  repeatability_note: "Four standardized store formats — highly repeatable signage packages.",
  unknowns: ["exact signage budget per store", "current approved sign supplier list"],
};

export const hcaResearchText =
  "HCA Houston Healthcare operates a large Houston-area network. HCA acquired 40 Texas MedClinic " +
  "urgent-care locations including 8 Houston clinics, converting them to HCA CareNow branding, " +
  "and continues outpatient expansion. Facilities leadership includes Jaime Izaguirre, Facilities " +
  "Director, HCA Houston Healthcare. Known Houston CareNow sites include Bellaire (rebranding " +
  "complete) and Copperfield (rebrand in progress).";

export const hcaProfile = {
  operator_summary: "Hospital system with a growing Houston urgent-care/outpatient footprint after the Texas MedClinic acquisition.",
  category: "healthcare",
  houston_location_count: 8,
  texas_location_count: 40,
  known_locations: [
    { name: "CareNow Bellaire", address: null, city: "Bellaire", status: "verified" },
    { name: "CareNow Copperfield", address: null, city: "Houston", status: "inferred" },
    { name: "CareNow Pearland (possible)", address: null, city: "Pearland", status: "assumed" },
  ],
  facility_contacts: [
    { name: "Jaime Izaguirre", title: "Facilities Director", role_type: "facilities", status: "verified" },
  ],
  activity_signals: ["40-clinic acquisition + rebrand program", "continued outpatient expansion"],
  incumbent_vendor_note: "National brand program likely has an incumbent signage vendor.",
  service_potential: "high",
  unknowns: ["which clinics still need rebranding", "incumbent vendor identity"],
};

export const manvelResearchText =
  "Manvel Town Center is a large mixed-use development in Manvel, TX (Highway 288 corridor) by " +
  "Weitzman, anchored by HEB. Announced tenants include Potbelly (Biddy Restaurant Group " +
  "franchisee, under construction) and Chipotle. Additional pad sites and inline retail are in " +
  "lease-up; roughly a dozen more tenants expected. DXU Architects is associated with tenant " +
  "buildouts.";

export const manvelProfile = {
  development_summary: "Mixed-use HEB-anchored development in Manvel on the 288 corridor, in active lease-up.",
  development_type: "retail_mixed_use",
  city: "Manvel",
  stage: "construction",
  players: [
    { name: "Weitzman", role: "developer", status: "verified" },
    { name: "DXU Architects", role: "architect", status: "inferred" },
    { name: "Unknown GC LLC", role: "general_contractor", status: "assumed" },
  ],
  announced_tenants: [
    { name: "Potbelly (Biddy Restaurant Group)", category: "restaurant", status: "verified" },
    { name: "Chipotle", category: "restaurant", status: "verified" },
    { name: "Rumored Coffee Concept", category: "restaurant", status: "assumed" },
  ],
  estimated_unannounced_tenant_count: 12,
  likely_hsc_scopes: ["monument", "directional", "tenant_signage", "building_signage"],
  revenue_estimate_low: 150000,
  revenue_estimate_high: 400000,
  unknowns: ["GC identity", "landlord sign criteria document"],
};
