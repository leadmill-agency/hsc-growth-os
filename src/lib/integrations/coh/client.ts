// City of Houston sold-permits feed (public WebFOCUS report server, no auth, no
// browser needed). Per Rameel 2026-09-10: filter to Certificates of Occupancy —
// a CO means a business is moving in and likely hasn't bought signage yet
// (a sign permit would mean a competitor already has the job).
// Endpoint reverse-engineered 2026-09-10: POST /ibi_apps/WFServlet with
// IBIF_ex=online_per_se; dates are yyyymmdd; PTYPE=OC = Occupancy.

const SERVLET_URL = "https://cohtora.houstontx.gov/ibi_apps/WFServlet";

export interface CohOccupancyRecord {
  permitNumber: string;
  businessName: string;
  address: string;
  description: string;
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

/** Fetch Certificates of Occupancy issued in the window. */
export async function fetchRecentOccupancyCertificates(opts: {
  sinceDays?: number;
} = {}): Promise<CohOccupancyRecord[]> {
  const end = new Date();
  const start = new Date(end.getTime() - (opts.sinceDays ?? 2) * 24 * 3600 * 1000);
  const body = new URLSearchParams({
    IBIF_ex: "online_per_se",
    SELTD: "PT",
    PTYPE: "OC",
    SRH: "",
    BDT: yyyymmdd(start),
    EDT: yyyymmdd(end),
    edit4: "",
    edit5: "",
    IBIAPP_app: "soldpermits",
  });
  const res = await fetch(SERVLET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`CoH permit query failed: HTTP ${res.status}`);
  const html = await res.text();
  return parseOccupancyRows(html);
}

/** Rows are embedded in the active-report JS as 'permit','*buyer','address','description' quadruplets. */
export function parseOccupancyRows(html: string): CohOccupancyRecord[] {
  const rows: CohOccupancyRecord[] = [];
  const pattern = /'(\d{8})','\*((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)','((?:[^'\\]|\\.)*)'/g;
  const unescape = (s: string) => s.replace(/\\(.)/g, "$1").trim();
  for (const match of html.matchAll(pattern)) {
    rows.push({
      permitNumber: match[1],
      businessName: unescape(match[2]),
      address: unescape(match[3]),
      description: unescape(match[4]),
    });
  }
  return rows;
}

/** Skip records with no storefront-signage potential (shell/core-only, residential). */
export function isSignageRelevant(record: CohOccupancyRecord): boolean {
  const text = `${record.businessName} ${record.description}`.toUpperCase();
  if (/\b(CORE ONLY|SHELL ONLY|RESIDENTIAL|APARTMENT UNIT)\b/.test(text)) return false;
  return true;
}

/** Render one CO as a radar signal (PB05 input). */
export function formatCohSignal(record: CohOccupancyRecord): { signalText: string; sourceUrl: string } {
  return {
    signalText:
      `City of Houston Certificate of Occupancy (permit ${record.permitNumber}): ` +
      `"${record.businessName}" at ${record.address}, Houston TX. ` +
      `Occupancy details: ${record.description}. ` +
      `A new certificate of occupancy means this business is opening or moving into this ` +
      `location now — storefront signage is typically purchased around this stage.`,
    sourceUrl: "https://cohtora.houstontx.gov/approot/soldpermits/online_permit.htm",
  };
}
