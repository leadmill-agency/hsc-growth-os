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

/** Apollo People Match — richer contact DB; primary when APOLLO_API_KEY is set. */
async function findViaApollo(params: FindEmailParams): Promise<FoundEmail | null> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) return null;
  const [firstName, ...rest] = params.fullName.split(/\s+/);
  const lastName = rest.join(" ");
  if (!firstName || !lastName) return null;
  try {
    const res = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        ...(params.domain ? { domain: params.domain } : {}),
        ...(params.company ? { organization_name: params.company } : {}),
        reveal_personal_emails: false,
      }),
    });
    if (!res.ok) {
      console.warn(`[email-finder] apollo HTTP ${res.status} for ${params.fullName}`);
      return null;
    }
    const json = (await res.json()) as {
      person?: { email?: string | null; email_status?: string | null };
    };
    const email = json.person?.email;
    if (!email || email.includes("email_not_unlocked")) return null;
    const confidence = json.person?.email_status === "verified" ? 95 : 60;
    return { email, confidence, source: "apollo" };
  } catch (err) {
    console.warn(`[email-finder] apollo lookup failed:`, (err as Error).message);
    return null;
  }
}

export async function findWorkEmail(params: FindEmailParams): Promise<FoundEmail | null> {
  if (testOverride) return testOverride(params);
  if (!params.fullName || (!params.domain && !params.company)) return null;
  // Apollo first (bigger contact database, per Rameel 2026-09-11); Hunter as fallback.
  const viaApollo = await findViaApollo(params);
  if (viaApollo) return viaApollo;
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;
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
