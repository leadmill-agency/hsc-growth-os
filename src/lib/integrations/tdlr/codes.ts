// TDLR TABS lookup codes, extracted from https://www.tdlr.texas.gov/TABS/Search (2026-09-07).
// TABS returns coded IDs for city/county/status/work-type; these tables decode the ones we use.

export const HOUSTON_METRO_COUNTIES: Record<string, number> = {
  Harris: 2101,
  "Fort Bend": 2079,
  Montgomery: 2167,
  Brazoria: 2020,
  Galveston: 2084,
  Waller: 2237,
  Liberty: 2146,
  Chambers: 2036,
};

export const COUNTY_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(HOUSTON_METRO_COUNTIES).map(([name, code]) => [code, name])
);

export const CITY_NAMES: Record<number, string> = {
  111: "Baytown",
  123: "Bellaire",
  361: "Conroe",
  408: "Cypress",
  785: "Houston",
  796: "Humble",
  856: "Katy",
  967: "League City",
  1062: "Manvel",
  1157: "Missouri City",
  1242: "North Houston",
  1320: "Pasadena",
  1327: "Pearland",
  1457: "Richmond",
  1640: "South Houston",
  1652: "Spring",
  1660: "Stafford",
  1679: "Sugar Land",
  1728: "The Woodlands",
  1749: "Tomball",
  1838: "Webster",
};

export const PROJECT_STATUS: Record<number, string> = {
  3001: "Inspection Complete",
  3007: "Project Closed",
  3008: "Project Registered",
  3009: "Review Complete",
};

// Observed values; TABS list responses show 9001/9002. Unverified codes fall back to the raw id.
export const WORK_TYPES: Record<number, string> = {
  9001: "new construction",
  9002: "renovation/alteration",
};
