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

  // RB2B's real payload uses spaced Title Case keys ("Company Name") — found
  // 2026-09-15 after 19 identifications fell through the camelCase-only mapping.
  const companyName = pick(raw, ["Company Name", "companyName", "company_name", "company", "organization"]);
  const website = pick(raw, ["Website", "companyDomain", "company_domain", "company_website", "website", "domain"]);
  const firstName = pick(raw, ["First Name", "firstName", "first_name"]);
  const lastName = pick(raw, ["Last Name", "lastName", "last_name"]);
  const personName =
    pick(raw, ["name", "full_name"]) ?? (firstName ? `${firstName} ${lastName ?? ""}`.trim() : undefined);
  const title = pick(raw, ["Title", "job_title", "jobTitle", "title"]);
  const industry = pick(raw, ["Industry", "industry"]);
  const linkedinUrl = pick(raw, ["LinkedIn URL", "linkedin_url", "linkedinUrl", "linkedin"]);
  const email = pick(raw, ["Business Email", "business_email", "email", "work_email"]);
  const capturedUrl = pick(raw, ["Captured URL", "captured_url", "page_url", "url"]);
  const cityState = [pick(raw, ["City", "city"]), pick(raw, ["State", "state"])].filter(Boolean).join(", ");
  const pagesVisited = pickPages(raw);
  const pageSeen = capturedUrl ?? pagesVisited[0] ?? "/";

  const db = await getDb();

  // Most identified visitors are consumers whose employer is irrelevant (a
  // teacher browsing monument signs). Keep the BUYING-INTENT ones: quote-page
  // visits, or construction/property/facilities people.
  const intentPage = /\/(quote|contact|lp\/)/i.test(pageSeen);
  const intentRole = /(construct|contractor|real estate|property|facilit|develop|architect|procurement|project manager|estimat|franchis|operations)/i.test(
    `${title ?? ""} ${industry ?? ""}`
  );
  if (!personName || (!intentPage && !intentRole)) {
    await saveEvidence(db, {
      entityType: "integration",
      entityId: "00000000-0000-0000-0000-000000000000",
      fieldName: "rb2b_unmapped_payload",
      value: raw,
      sourceName: "rb2b_webhook",
      verificationStatus: "verified",
    });
    return NextResponse.json({ stored: true, relevant: false }, { status: 202 });
  }

  // A visitor card straight into the triage inbox — deterministic, no AI cost.
  const { createOpportunity } = await import("@/lib/actions/entities");
  const page = pageSeen.replace(/^https?:\/\/[^/]+/, "") || "/";
  const { opportunity, created } = await createOpportunity(db, {
    name: `Website visitor: ${personName}${title ? ` (${title})` : ""} — viewed ${page}`,
    opportunityType: "website_visitor",
    stage: "discovered",
    source: "website_intent",
    sourceDetail: linkedinUrl,
    actor: "integration",
  });
  if (created) {
    await db
      .update((await import("@/lib/db/schema")).opportunities)
      .set({ overallScore: intentPage ? 75 : 60, nextAction: "Needs your read" })
      .where((await import("drizzle-orm")).eq((await import("@/lib/db/schema")).opportunities.id, opportunity.id));
    await saveEvidence(db, {
      entityType: "opportunity",
      entityId: opportunity.id,
      fieldName: "origin_signal",
      value:
        `Identified website visitor (RB2B): ${personName}${title ? `, ${title}` : ""}` +
        `${companyName ? ` at ${companyName}` : ""}${cityState ? ` — ${cityState}` : ""}. ` +
        `Viewed ${pageSeen}.` +
        `${email ? ` Email: ${email}.` : ""}${linkedinUrl ? ` LinkedIn: ${linkedinUrl}.` : ""}`,
      sourceUrl: linkedinUrl,
      sourceName: "rb2b_webhook",
      verificationStatus: "verified",
    });
    await saveEvidence(db, {
      entityType: "opportunity",
      entityId: opportunity.id,
      fieldName: "why_this_matters",
      value: intentPage
        ? `${personName} opened the quote/contact page — live buying intent from an identified visitor.`
        : `${personName} (${title}) browsed ${page} — role suggests commercial relevance.`,
      sourceName: "rb2b_webhook",
      verificationStatus: "inferred",
    });
  }
  void launchRun; void executeRun; // PB08 remains available for manual deep-dives
  return NextResponse.json({ opportunityId: opportunity.id, created }, { status: 202 });
}
