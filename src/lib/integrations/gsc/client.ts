// Google Search Console adapter — feeds PB17 with real content gaps:
// queries where the site gets impressions but ranks poorly or gets few clicks.
// Auth: service account key in GSC_CREDENTIALS_B64 (base64 of the JSON file).

const PROPERTY = "sc-domain:houstonsigncrafters.com";

export interface ContentGap {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
}

let override: ContentGap[] | null = null;

export function setGscGapsForTests(gaps: ContentGap[] | null) {
  override = gaps;
}

export async function fetchContentGaps(opts: {
  minImpressions?: number;
  minPosition?: number;
  days?: number;
  limit?: number;
} = {}): Promise<ContentGap[]> {
  if (override) return override;
  const b64 = process.env.GSC_CREDENTIALS_B64;
  if (!b64) throw new Error("GSC_CREDENTIALS_B64 is not set");
  const credentials = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  const { google } = await import("googleapis");
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const sc = google.searchconsole({ version: "v1", auth });
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - (opts.days ?? 28) * 864e5).toISOString().slice(0, 10);
  const res = await sc.searchanalytics.query({
    siteUrl: PROPERTY,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ["query"],
      rowLimit: 250,
    },
  });
  const minImpressions = opts.minImpressions ?? 20;
  const minPosition = opts.minPosition ?? 8;
  const gaps: ContentGap[] = [];
  for (const row of res.data.rows ?? []) {
    const query = row.keys?.[0] ?? "";
    // Brand searches aren't content gaps
    if (/houston sign crafters|hsc/i.test(query)) continue;
    const impressions = row.impressions ?? 0;
    const position = row.position ?? 0;
    if (impressions >= minImpressions && position >= minPosition) {
      gaps.push({ query, impressions, clicks: row.clicks ?? 0, position: Math.round(position * 10) / 10 });
    }
  }
  return gaps.slice(0, opts.limit ?? 10);
}
