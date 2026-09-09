import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { saveEvidence } from "@/lib/actions/entities";

// RB2B webhook adapter → PB08 High-Intent Visitor.
// RB2B's dashboard takes a bare URL (no custom headers), so the token rides the
// query string: POST /api/rb2b?token=<VISITOR_INTAKE_TOKEN>
// RB2B payload shapes vary by plan/version, so extraction is defensive: every raw
// payload is stored as evidence first, then mapped best-effort. After the first
// real webhook lands, tighten the mapping against the stored payloads.

function pick(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickPages(obj: Record<string, unknown>): string[] {
  for (const key of ["pagesVisited", "recent_page_views", "page_views", "pages", "captured_url_history", "urls"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === "string" ? v : typeof v === "object" && v ? String((v as Record<string, unknown>).url ?? (v as Record<string, unknown>).page ?? "") : ""))
        .filter(Boolean);
    }
  }
  const single = pick(obj, ["last_page_viewed", "page_url", "url", "landing_page"]);
  return single ? [single] : [];
}

export async function POST(request: NextRequest) {
  const token = process.env.VISITOR_INTAKE_TOKEN;
  const provided = request.nextUrl.searchParams.get("token") ?? request.headers.get("x-intake-token");
  if (!token || provided !== token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const companyName = pick(raw, ["companyName", "company_name", "company", "organization"]);
  const website = pick(raw, ["companyDomain", "company_domain", "company_website", "website", "domain"]);
  const firstName = pick(raw, ["firstName", "first_name"]);
  const lastName = pick(raw, ["lastName", "last_name"]);
  const personName =
    pick(raw, ["name", "full_name"]) ?? (firstName ? `${firstName} ${lastName ?? ""}`.trim() : undefined);
  const pagesVisited = pickPages(raw);

  const db = await getDb();

  if (!companyName) {
    // Person identified but company missing (or unrecognized shape): keep the payload
    // so the mapping can be fixed — never silently drop an identification we paid for.
    await saveEvidence(db, {
      entityType: "integration",
      entityId: "00000000-0000-0000-0000-000000000000", // fixed id for integration-level evidence
      fieldName: "rb2b_unmapped_payload",
      value: raw,
      sourceName: "rb2b_webhook",
      verificationStatus: "verified",
    });
    return NextResponse.json({ stored: true, mapped: false }, { status: 202 });
  }

  const runId = await launchRun(db, {
    ploybookKey: "pb08_high_intent_visitor",
    triggerType: "webhook:rb2b",
    triggerPayload: {
      companyName,
      website,
      pagesVisited: pagesVisited.length ? pagesVisited : ["/"],
      visitCount: 1,
      person: personName
        ? {
            name: personName,
            title: pick(raw, ["job_title", "jobTitle", "title"]),
            linkedinUrl: pick(raw, ["linkedin_url", "linkedinUrl", "linkedin"]),
            email: pick(raw, ["business_email", "email", "work_email"]),
          }
        : undefined,
      rawPayload: raw,
    },
    initiatedBy: "integration",
  });
  void executeRun(db, runId).catch((err) => console.error(`[rb2b] run ${runId} failed:`, err));
  return NextResponse.json({ runId }, { status: 202 });
}
