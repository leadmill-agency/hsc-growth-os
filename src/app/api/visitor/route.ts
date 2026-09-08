import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";

// PB08 intake: identified-visitor events (RB2B webhook or any other source).
// POST { companyName, website?, pagesVisited: string[], visitCount? }
// Guarded by X-Intake-Token == VISITOR_INTAKE_TOKEN.

export async function POST(request: NextRequest) {
  const token = process.env.VISITOR_INTAKE_TOKEN;
  if (!token || request.headers.get("x-intake-token") !== token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    companyName?: string;
    website?: string;
    pagesVisited?: string[];
    visitCount?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.companyName || !Array.isArray(body.pagesVisited)) {
    return NextResponse.json({ error: "companyName and pagesVisited required" }, { status: 400 });
  }
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: "pb08_high_intent_visitor",
    triggerType: "webhook:visitor",
    triggerPayload: {
      companyName: body.companyName,
      website: body.website,
      pagesVisited: body.pagesVisited,
      visitCount: body.visitCount ?? 1,
    },
    initiatedBy: "integration",
  });
  void executeRun(db, runId).catch((err) =>
    console.error(`[visitor] run ${runId} failed:`, err)
  );
  return NextResponse.json({ runId }, { status: 202 });
}
