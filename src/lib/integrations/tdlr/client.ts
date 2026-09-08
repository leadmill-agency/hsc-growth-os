import { CITY_NAMES, COUNTY_NAMES, HOUSTON_METRO_COUNTIES, PROJECT_STATUS, WORK_TYPES } from "./codes";

// TDLR TABS project-registration feed (public, no auth).
// Endpoint: POST /TABS/Search/SearchProjects — a DataTables server-side endpoint returning JSON.
// TABS registrations are commercial construction projects >= $50k statewide — an early signal
// for PB05: a filing usually precedes signage procurement by months.

const SEARCH_URL = "https://www.tdlr.texas.gov/TABS/Search/SearchProjects";

export interface TdlrProject {
  ProjectId: string;
  ProjectNumber: string;
  ProjectName: string;
  ProjectCreatedOn: string;
  ProjectStatus: number;
  FacilityName: string;
  City: number;
  County: number;
  TypeOfWork: number;
  EstimatedCost: number;
  EstimatedStartDate: string | null;
  EstimatedEndDate: string | null;
}

export async function searchTdlrProjects(params: {
  countyCode: number;
  start?: number;
  length?: number;
}): Promise<TdlrProject[]> {
  const body = new URLSearchParams({
    draw: "1",
    start: String(params.start ?? 0),
    length: String(params.length ?? 50),
    "order[0][column]": "3", // created date
    "order[0][dir]": "desc",
    LocationCounty: String(params.countyCode),
  });
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`TDLR search failed: HTTP ${res.status}`);
  const json = (await res.json()) as { data: TdlrProject[] };
  return json.data ?? [];
}

export interface TdlrPullOptions {
  /** Counties to scan; defaults to all Greater Houston counties. */
  countyCodes?: number[];
  /** Only projects created within this many days. */
  sinceDays?: number;
  /** Minimum estimated cost — small projects rarely carry meaningful signage. */
  minCost?: number;
  /** Hard cap on returned signals (each becomes an LLM-classified PB05 run). */
  maxResults?: number;
}

export async function fetchRecentHoustonProjects(opts: TdlrPullOptions = {}): Promise<TdlrProject[]> {
  const countyCodes = opts.countyCodes ?? Object.values(HOUSTON_METRO_COUNTIES);
  const since = Date.now() - (opts.sinceDays ?? 3) * 24 * 3600 * 1000;
  const minCost = opts.minCost ?? 200_000;
  const results: TdlrProject[] = [];
  for (const countyCode of countyCodes) {
    const rows = await searchTdlrProjects({ countyCode, length: 50 });
    for (const row of rows) {
      const createdAt = Date.parse(row.ProjectCreatedOn);
      if (Number.isFinite(createdAt) && createdAt < since) continue;
      if ((row.EstimatedCost ?? 0) < minCost) continue;
      results.push(row);
    }
  }
  results.sort((a, b) => (b.EstimatedCost ?? 0) - (a.EstimatedCost ?? 0));
  return results.slice(0, opts.maxResults ?? 20);
}

/** Render a TABS row as a radar signal (PB05 input). */
export function formatTdlrSignal(p: TdlrProject): { signalText: string; sourceUrl: string } {
  const city = CITY_NAMES[p.City] ?? `city code ${p.City}`;
  const county = COUNTY_NAMES[p.County] ?? `county code ${p.County}`;
  const work = WORK_TYPES[p.TypeOfWork] ?? `work type ${p.TypeOfWork}`;
  const status = PROJECT_STATUS[p.ProjectStatus] ?? `status ${p.ProjectStatus}`;
  const start = p.EstimatedStartDate ? p.EstimatedStartDate.slice(0, 10) : "unknown";
  return {
    signalText:
      `TDLR TABS filing ${p.ProjectNumber}: "${p.ProjectName}" at facility "${p.FacilityName}", ` +
      `${city}, ${county} County, TX. ${work}, estimated cost $${Math.round(p.EstimatedCost).toLocaleString()}, ` +
      `status: ${status}, estimated construction start ${start}. ` +
      `Commercial construction registration — signage procurement typically follows.`,
    sourceUrl: `https://www.tdlr.texas.gov/TABS/Search/Project/${p.ProjectId}`,
  };
}
