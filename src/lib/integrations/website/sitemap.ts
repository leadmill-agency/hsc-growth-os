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

// Topic-level coverage (PB17 + weekly scan): a slug-substring check missed that
// "Do I need a permit for a business sign in Houston?" was already covered by
// /blog/houston-business-sign-permits (2026-09-18). Compare meaningful word
// stems instead: covered when 70%+ of them appear in an existing URL path.

const TOPIC_STOPWORDS = new Set([
  "a", "an", "the", "do", "i", "for", "in", "of", "to", "is", "and", "or", "vs",
  "what", "which", "how", "much", "my", "your", "are", "you", "we", "on", "with",
  "does", "need", "it", "its", "this", "that", "can", "should", "get", "who",
  "when", "where", "why", "will", "right",
]);

/** Meaningful word stems of a topic/question (plural s stripped, stopwords out). */
export function topicStems(topic: string): string[] {
  const stems = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !TOPIC_STOPWORDS.has(w))
    .map((w) => w.replace(/s$/, ""));
  return [...new Set(stems)];
}

/**
 * URLs that already cover this topic: 70%+ of its stems (and at least 2)
 * appear in the URL. Matching the FULL url (not just the path) is deliberate:
 * the domain houstonsigncrafters.com auto-satisfies the stems "houston" and
 * "sign", which is the right discount here — every page is about signs in
 * Houston, so only the distinctive words of a topic decide coverage.
 */
export function findTopicCoveringUrls(urls: string[], topic: string): string[] {
  const stems = topicStems(topic);
  if (stems.length < 2) return [];
  return urls.filter((url) => {
    const path = url.toLowerCase();
    const hits = stems.filter((s) => path.includes(s)).length;
    return hits >= 2 && hits / stems.length >= 0.7;
  });
}

/** Two topics are near-duplicates when their stem sets mostly overlap. */
export function topicsOverlap(a: string, b: string): boolean {
  const sa = topicStems(a);
  const sb = new Set(topicStems(b));
  if (sa.length === 0 || sb.size === 0) return false;
  const shared = sa.filter((s) => sb.has(s)).length;
  return shared / Math.min(sa.length, sb.size) >= 0.7;
}
