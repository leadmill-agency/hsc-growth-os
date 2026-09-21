import type { Db } from "@/lib/db/client";
import { approvals } from "@/lib/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { logActivity } from "@/lib/events";
import { sendExternal, SendBlockedError, type OutboundMessage } from "./send";

// Human-cadence send queue (Rameel 2026-09-21: "work on them at night but the
// emails get sent... starting at 9am, like 5 minutes apart"). Approving an
// email QUEUES it; a minute-level scheduler tick delivers due messages inside
// the send window — 9:00am–5:30pm Houston time, weekdays — spaced ~5 minutes
// apart with jitter so a batch approved at midnight drips out like a person
// sending them. The guarded send layer (ALLOW_EXTERNAL_SEND, daily cap,
// approved-unused approval) still rules every actual delivery.

const WINDOW_START_MIN = 9 * 60; // 9:00am CT
const WINDOW_END_MIN = 17 * 60 + 30; // 5:30pm CT
const SPACING_MS = 5 * 60 * 1000;
const JITTER_MS = 2 * 60 * 1000;

function chicago(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: get("weekday"),
    utcOffsetHours: get("timeZoneName") === "CDT" ? 5 : 6,
  };
}

/** The UTC instant of a given wall-clock minute in Chicago on ct's calendar day. */
function chicagoWallClock(ct: ReturnType<typeof chicago>, minutes: number): Date {
  return new Date(Date.UTC(ct.y, ct.m - 1, ct.d, Math.floor(minutes / 60) + ct.utcOffsetHours, minutes % 60));
}

/** Push an instant forward until it sits inside the weekday send window. */
export function intoSendWindow(from: Date): Date {
  let t = new Date(from);
  for (let i = 0; i < 10; i++) {
    const ct = chicago(t);
    if (ct.weekday === "Sat") {
      t = new Date(chicagoWallClock(ct, WINDOW_START_MIN).getTime() + 2 * 86400000);
      continue;
    }
    if (ct.weekday === "Sun") {
      t = new Date(chicagoWallClock(ct, WINDOW_START_MIN).getTime() + 1 * 86400000);
      continue;
    }
    if (ct.minutes < WINDOW_START_MIN) return chicagoWallClock(ct, WINDOW_START_MIN);
    if (ct.minutes > WINDOW_END_MIN) {
      t = new Date(chicagoWallClock(ct, WINDOW_START_MIN).getTime() + 86400000);
      continue;
    }
    return t;
  }
  return t;
}

type QueuedSend = OutboundMessage & { sendAt: string };

async function queuedRows(db: Db) {
  const rows = await db.query.approvals.findMany({
    where: inArray(approvals.status, ["approved", "edited"]),
    orderBy: (a, { desc }) => [desc(a.resolvedAt)],
    limit: 200,
  });
  return rows.filter((a) => {
    const p = a.payload as { queuedSend?: QueuedSend; sentAt?: string };
    return p.queuedSend && !p.sentAt;
  });
}

/** Queue an approved email: next free slot ≥ window start, ~5 min after the last one. */
export async function queueEmail(db: Db, approvalId: string, message: OutboundMessage): Promise<Date> {
  const queued = await queuedRows(db);
  const lastSlot = queued.reduce((max, a) => {
    const at = new Date((a.payload as { queuedSend: QueuedSend }).queuedSend.sendAt).getTime();
    return at > max ? at : max;
  }, 0);
  const jitter = Math.floor(Math.random() * JITTER_MS);
  const earliest = intoSendWindow(new Date(Date.now() + 30000));
  const afterLast = lastSlot ? intoSendWindow(new Date(lastSlot + SPACING_MS + jitter)) : earliest;
  const sendAt = afterLast.getTime() > earliest.getTime() ? afterLast : earliest;

  const queuedSend: QueuedSend = { ...message, sendAt: sendAt.toISOString() };
  await db
    .update(approvals)
    .set({
      payload: sql`jsonb_set(${approvals.payload}, '{queuedSend}', ${JSON.stringify(queuedSend)}::jsonb)`,
    })
    .where(eq(approvals.id, approvalId));
  await logActivity(db, {
    entityType: "approval",
    entityId: approvalId,
    action: "outreach.queued",
    detail: `Queued for ${sendAt.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" })} CT → ${message.to}`,
    actor: "system",
  });
  return sendAt;
}

/** Deliver due queued emails. Runs every minute from the scheduler. */
export async function processSendQueue(db: Db): Promise<number> {
  const due = (await queuedRows(db)).filter(
    (a) => new Date((a.payload as { queuedSend: QueuedSend }).queuedSend.sendAt).getTime() <= Date.now()
  );
  let sent = 0;
  for (const a of due.slice(0, 3)) {
    const q = (a.payload as { queuedSend: QueuedSend }).queuedSend;
    try {
      await sendExternal(db, a.id, {
        channel: "email",
        to: q.to,
        subject: q.subject,
        body: q.body,
        opportunityId: q.opportunityId,
        accountId: q.accountId,
        contactId: q.contactId,
      });
      sent++;
    } catch (err) {
      if (err instanceof SendBlockedError && /daily send cap/i.test(err.message)) {
        // Cap reached: slide this (and implicitly the rest) to tomorrow's window.
        const tomorrow = intoSendWindow(new Date(Date.now() + 86400000 - 60000));
        await db
          .update(approvals)
          .set({
            payload: sql`jsonb_set(${approvals.payload}, '{queuedSend,sendAt}', ${JSON.stringify(tomorrow.toISOString())}::jsonb)`,
          })
          .where(eq(approvals.id, a.id));
        await logActivity(db, {
          entityType: "approval",
          entityId: a.id,
          action: "outreach.requeued",
          detail: `Daily send cap reached — rescheduled to ${tomorrow.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" })} CT`,
          actor: "system",
        });
        break; // everything behind it will also hit the cap today
      }
      // Any other failure must be VISIBLE and retryable: back to pending with
      // the error on the card (same contract as the old direct-send path).
      console.warn(`[send-queue] send failed for approval ${a.id}:`, (err as Error).message);
      await db
        .update(approvals)
        .set({
          status: "pending",
          resolvedAt: null,
          resolvedBy: null,
          payload: sql`jsonb_set(${approvals.payload} - 'queuedSend', '{send_error}', ${JSON.stringify(
            `Send failed: ${(err as Error).message.slice(0, 160)} — fix and approve again.`
          )}::jsonb)`,
        })
        .where(eq(approvals.id, a.id));
    }
  }
  return sent;
}
