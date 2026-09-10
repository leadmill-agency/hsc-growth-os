// Coverage check against the live website (PB16/PB17): does a page for this
// topic already exist? Reads the public sitemap — no API keys needed.
// Adapter-pattern with a test override like every other integration.

const SITEMAP_URL = "https://houstonsigncrafters.com/sitemap.xml";

let override: string[] | null = null;

export function setSitemapForTests(urls: string[] | null) {
  override = urls;
}

export async function fetchSitemapUrls(): Promise<string[]> {
  if (override) return override;
  const res = await fetch(SITEMAP_URL, { headers: { "User-Agent": "HSC-GrowthOS/1.0" } });
  if (!res.ok) throw new Error(`Sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** Loose containment check: do any existing URLs cover these keywords? */
export function findCoveringUrls(urls: string[], keywords: string[]): string[] {
  const normalized = keywords.map((k) => k.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  return urls.filter((url) => {
    const path = url.toLowerCase();
    return normalized.every((k) => path.includes(k));
  });
}
