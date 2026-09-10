// Work-email lookup, provider-agnostic (Hunter.io today — swap by adding a
// provider, same pattern as research/LLM adapters). Name + company domain in,
// verified email + confidence out. Enrichment must never block a playbook:
// callers treat null as "not found, human fills it in".

export interface FoundEmail {
  email: string;
  /** Provider confidence 0-100. Below ~80, verify before sending. */
  confidence: number;
  source: string;
}

export interface FindEmailParams {
  fullName: string;
  domain?: string;
  company?: string;
}

type FinderOverride = (params: FindEmailParams) => Promise<FoundEmail | null>;
let testOverride: FinderOverride | null = null;

export function setEmailFinderForTests(fn: FinderOverride | null) {
  testOverride = fn;
}

export async function findWorkEmail(params: FindEmailParams): Promise<FoundEmail | null> {
  if (testOverride) return testOverride(params);
  const key = process.env.HUNTER_API_KEY;
  if (!key || !params.fullName || (!params.domain && !params.company)) return null;
  try {
    const qs = new URLSearchParams({ full_name: params.fullName, api_key: key });
    if (params.domain) qs.set("domain", params.domain);
    else if (params.company) qs.set("company", params.company);
    const res = await fetch(`https://api.hunter.io/v2/email-finder?${qs}`);
    if (!res.ok) {
      console.warn(`[email-finder] hunter HTTP ${res.status} for ${params.fullName}`);
      return null;
    }
    const json = (await res.json()) as { data?: { email?: string | null; score?: number | null } };
    if (!json.data?.email) return null;
    return { email: json.data.email, confidence: json.data.score ?? 0, source: "hunter" };
  } catch (err) {
    console.warn(`[email-finder] lookup failed:`, (err as Error).message);
    return null;
  }
}
