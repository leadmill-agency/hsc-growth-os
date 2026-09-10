// TDLR TABS lookup codes, extracted from https://www.tdlr.texas.gov/TABS/Search (2026-09-07).
// TABS returns coded IDs for city/county/status/work-type; these tables decode the ones we use.

// HSC's service area: ~150 miles from downtown Houston (per Rameel 2026-09-10).
// Core metro first, then the surrounding ring out to Beaumont, College Station,
// Victoria, and Bastrop. Codes verified against the live TABS county dropdown.
export const HOUSTON_METRO_COUNTIES: Record<string, number> = {
  // Core metro
  Harris: 2101,
  "Fort Bend": 2079,
  Montgomery: 2167,
  Brazoria: 2020,
  Galveston: 2084,
  Waller: 2237,
  Liberty: 2146,
  Chambers: 2036,
  // Ring (~150-mile radius)
  Angelina: 2003,
  Austin: 2008,
  Bastrop: 2011,
  Brazos: 2021,
  Burleson: 2026,
  Calhoun: 2029,
  Colorado: 2045,
  Fayette: 2075,
  Grimes: 2093,
  Hardin: 2100,
  Houston: 2113,
  Jackson: 2120,
  Jasper: 2121,
  Jefferson: 2123,
  Lavaca: 2143,
  Lee: 2144,
  Leon: 2145,
  Madison: 2154,
  Matagorda: 2158,
  Milam: 2163,
  Newton: 2176,
  Orange: 2181,
  Polk: 2187,
  Robertson: 2198,
  "San Jacinto": 2204,
  Trinity: 2228,
  Tyler: 2229,
  Victoria: 2235,
  Walker: 2236,
  Washington: 2239,
  Wharton: 2241,
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
