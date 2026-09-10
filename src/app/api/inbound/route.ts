import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun } from "@/lib/ploybooks/runner";
import { saveEvidence } from "@/lib/actions/entities";
import { emitEvent, logActivity } from "@/lib/events";

// Inbound email intake → PB10 Incoming Bid.
// Flow: PlanHub notifies ray@htxsigncrafters.com → Gmail filter forwards to the
// Resend receiving address → Resend webhook POSTs here (email.received carries
// metadata only; the body is fetched from the Received Emails API).
// Token rides the query string like /api/rb2b: POST /api/inbound?token=<INBOUND_EMAIL_TOKEN>

const INTEGRATION_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

type ResendReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    message_id?: string;
  };
};

async function fetchReceivedBody(emailId: string): Promise<{ text: string; from: string; subject: string } | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`[inbound] failed to fetch received email ${emailId}: ${res.status}`);
    return null;
  }
  const body = (await res.json()) as { text?: string | null; html?: string | null; from?: string; subject?: string };
  const text =
    body.text?.trim() ||
    // Fallback: crude tag strip so an HTML-only email still yields parseable text.
    (body.html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { text, from: body.from ?? "", subject: body.subject ?? "" };
}

export async function POST(request: NextRequest) {
  const token = process.env.INBOUND_EMAIL_TOKEN;
  const provided = request.nextUrl.searchParams.get("token") ?? request.headers.get("x-intake-token");
  if (!token || provided !== token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let raw: ResendReceivedEvent & { from?: string; subject?: string; text?: string };
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  // Resend sends several webhook event types if broadly subscribed — only act on received mail.
  if (raw.type && raw.type !== "email.received") {
    return NextResponse.json({ ignored: raw.type }, { status: 202 });
  }

  const db = await getDb();
  const emailId = raw.data?.email_id;
  const messageId = raw.data?.message_id ?? emailId ?? null;

  // Body: fetched from Resend for real webhooks; inline for manual tests.
  let from = raw.data?.from ?? raw.from ?? "";
  let subject = raw.data?.subject ?? raw.subject ?? "";
  let text = raw.text ?? "";
  if (emailId && !text) {
    const fetched = await fetchReceivedBody(emailId);
    if (fetched) {
      text = fetched.text;
      from = fetched.from || from;
      subject = fetched.subject || subject;
    }
  }

  // Gmail's forward-address confirmation must reach a human, not PB10 — the
  // code/link lands in History so the filter setup can be completed.
  if (/forwarding-noreply@google\.com/i.test(from) || /gmail forwarding confirmation/i.test(subject)) {
    await saveEvidence(db, {
      entityType: "integration",
      entityId: INTEGRATION_ENTITY_ID,
      fieldName: "gmail_forwarding_confirmation",
      value: { from, subject, text: text.slice(0, 5000) },
      sourceName: "inbound_email",
      verificationStatus: "verified",
    });
    await logActivity(db, {
      entityType: "integration",
      entityId: INTEGRATION_ENTITY_ID,
      action: "email.forwarding_confirmation",
      detail: `Gmail forwarding confirmation received — code/link stored: ${text.slice(0, 200)}`,
      actor: "integration",
    });
    return NextResponse.json({ stored: "forwarding_confirmation" }, { status: 202 });
  }

  if (!text && !subject) {
    return NextResponse.json({ error: "empty email" }, { status: 202 });
  }

  // Dedupe: PlanHub notifies every user on the account, and Gmail can forward
  // the same message more than once. One run per message-id.
  if (messageId) {
    const { events } = await import("@/lib/db/schema");
    const { and, eq, sql } = await import("drizzle-orm");
    const dup = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.eventType, "email.inbound_received"), sql`${events.payload}->>'messageId' = ${messageId}`))
      .limit(1);
    if (dup.length > 0) {
      return NextResponse.json({ deduped: messageId }, { status: 202 });
    }
  }
  await emitEvent(db, {
    eventType: "email.inbound_received",
    payload: { messageId, from, subject },
  });
  await logActivity(db, {
    entityType: "integration",
    entityId: INTEGRATION_ENTITY_ID,
    action: "email.inbound_received",
    detail: `${subject || "(no subject)"} — from ${from}`,
    actor: "integration",
  });

  const inviteText = `From: ${from}\nSubject: ${subject}\n\n${text}`.slice(0, 20000);
  const runId = await launchRun(db, {
    ploybookKey: "pb10_incoming_bid",
    triggerType: "webhook:inbound_email",
    triggerPayload: { inviteText, source: "email_inbound" },
    initiatedBy: "integration",
  });
  void executeRun(db, runId).catch((err) => console.error(`[inbound] run ${runId} failed:`, err));
  return NextResponse.json({ runId }, { status: 202 });
}
