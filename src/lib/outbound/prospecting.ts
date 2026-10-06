import type { Db } from "@/lib/db/client";
import { accounts, approvals, contacts, events, interactions, outreachEnrollments } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";
import { createAccount, slugify } from "@/lib/actions/entities";
import {
  FinderQuotaError,
  revealApolloPerson,
  searchTexasProspects,
} from "@/lib/integrations/email-finder/client";
import {
  FOLLOWUP_OFFSETS_BUSINESS_DAYS,
  SEGMENT_LABELS,
  addBusinessDays,
  renderTouch,
  type Market,
  type Segment,
} from "./templates";

// Texas repeat-buyer outreach (Rameel 2026-10-01). Franchise cold email got 0
// replies in 35 sends, so the lane changed: become one of the 3–5 sign
// companies that contractors, property managers, developers, and architects
// email whenever signage comes up. Every weekday morning this builds a small
// batch of NEW people from Apollo (all of Texas incl. Dallas; PlanHub is NOT a
// source — Jamal works those GCs himself) and drafts touch 1 from the
// approved templates into the Outbox. Follow-ups draft themselves when due.
// Nothing sends without Rameel approving each email (his call for the first
// days, 2026-10-01). A reply or bounce stops the person's sequence.

export const SEGMENT_SEARCH: Record<
  Segment,
  { titles: string[]; keywordTags: string[]; employeeRanges: string[]; accountType: string; weight: number }
> = {
  // GCs keep bid lists — the strongest group, so the biggest share of each batch.
  gc: {
    titles: ["estimator", "chief estimator", "senior estimator", "preconstruction manager", "director of preconstruction"],
    keywordTags: ["general contractor", "commercial construction"],
    employeeRanges: ["11,50", "51,200", "201,1000"],
    accountType: "general_contractor",
    weight: 0.4,
  },
  property_manager: {
    titles: ["property manager", "senior property manager", "regional property manager", "director of property management"],
    keywordTags: ["commercial real estate", "retail real estate", "commercial property management"],
    employeeRanges: ["11,50", "51,200", "201,1000", "1001,5000"],
    accountType: "property_manager",
    weight: 0.25,
  },
  developer: {
    titles: ["director of development", "vice president of development", "development manager", "director of construction"],
    keywordTags: ["real estate development", "commercial real estate"],
    employeeRanges: ["11,50", "51,200", "201,1000"],
    accountType: "developer",
    weight: 0.2,
  },
  architect: {
    titles: ["principal", "principal architect", "project architect", "architect"],
    keywordTags: ["architecture", "commercial architecture"],
    employeeRanges: ["11,50", "51,200", "201,1000"],
    accountType: "architect",
    weight: 0.15,
  },
};

const SEGMENTS = Object.keys(SEGMENT_SEARCH) as Segment[];

const HOUSTON = [
  "houston", "katy", "sugar land", "the woodlands", "spring", "cypress", "pearland", "humble", "kingwood",
  "conroe", "league city", "pasadena", "baytown", "missouri city", "richmond", "rosenberg", "tomball",
  "friendswood", "stafford", "bellaire", "webster", "galveston", "texas city", "clear lake", "seabrook",
  "magnolia", "fulshear", "atascocita", "deer park", "la porte", "channelview", "brookshire", "manvel",
];
const SAN_ANTONIO = ["san antonio", "new braunfels", "boerne", "schertz", "seguin", "converse", "helotes", "universal city", "live oak", "cibolo"];
const AUSTIN = [
  "austin", "round rock", "cedar park", "georgetown", "pflugerville", "leander", "kyle", "buda", "san marcos",
  "lakeway", "bee cave", "hutto", "dripping springs", "west lake hills",
];
const DFW = [
  "dallas", "fort worth", "plano", "frisco", "irving", "arlington", "mckinney", "richardson", "addison",
  "southlake", "grapevine", "allen", "garland", "carrollton", "denton", "lewisville", "coppell", "flower mound",
  "mansfield", "keller", "grand prairie", "mesquite", "rockwall", "prosper", "colleyville", "the colony",
  "farmers branch", "euless", "bedford", "hurst", "north richland hills", "weatherford", "university park",
];

export function marketForCity(city?: string | null): Market {
  const c = (city ?? "").toLowerCase().trim();
  if (HOUSTON.includes(c)) return "houston";
  if (SAN_ANTONIO.includes(c)) return "san_antonio";
  if (AUSTIN.includes(c)) return "austin";
  if (DFW.includes(c)) return "dfw";
  return "texas";
}

/** Split the day's count across groups by weight; rounding leftovers go to GCs. */
export function segmentQuotas(total: number): Record<Segment, number> {
  const q = {} as Record<Segment, number>;
  let used = 0;
  for (const s of SEGMENTS) {
    q[s] = Math.floor(total * SEGMENT_SEARCH[s].weight);
    used += q[s];
  }
  q.gc += total - used;
  return q;
}

export function newPerDay(): number {
  return Number(process.env.OUTREACH_NEW_PER_DAY ?? 15);
}

// Competitors and HSC itself never get a "join your bid list" email.
const SKIP_ORG = /\bsigns?\b|signage|sign crafters/i;

export async function outreachBatchBuiltToday(db: Db): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const row = await db.query.events.findFirst({
    where: and(eq(events.eventType, "outreach.batch_built"), gte(events.occurredAt, startOfDay)),
  });
  return !!row;
}

type EnrollmentRow = typeof outreachEnrollments.$inferSelect;

async function draftTouch(db: Db, enrollment: EnrollmentRow, step: 1 | 2 | 3) {
  const contact = enrollment.contactId
    ? await db.query.contacts.findFirst({ where: eq(contacts.id, enrollment.contactId) })
    : null;
  const account = enrollment.accountId
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, enrollment.accountId) })
    : null;
  if (!contact?.firstName || !account) return null;
  const segment = enrollment.segment as Segment;
  const { subject, body } = renderTouch({
    segment,
    step,
    firstName: contact.firstName,
    company: account.name,
    market: enrollment.market as Market,
    threadSubject: enrollment.threadSubject,
  });
  const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return createSequenceApproval(db, {
    title: `Texas outreach · ${SEGMENT_LABELS[segment]} · ${account.name} — ${fullName} (email ${step} of 3)`,
    payload: {
      enrollmentId: enrollment.id,
      step,
      segment,
      market: enrollment.market,
      accountId: account.id,
      contactId: contact.id,
      draft: {
        subject,
        body,
        target_contact: [fullName, contact.title].filter(Boolean).join(", "),
        suggested_email: enrollment.email,
        suggested_email_confidence: 95,
        suggested_email_source: "apollo",
      },
    },
  });
}

async function createSequenceApproval(db: Db, input: { title: string; payload: Record<string, unknown> }) {
  const [row] = await db
    .insert(approvals)
    .values({
      approvalType: "sequence_email",
      title: input.title,
      proposedAction: "Approved template, merge fields filled. Approving queues it for the 9am–5:30pm send window.",
      payload: input.payload,
      status: "pending",
    })
    .returning();
  return row.id;
}

/** Morning batch: find new Texas people in Apollo, enroll them, draft email 1. */
export async function buildDailyOutreachBatch(db: Db, opts: { total?: number } = {}) {
  const quotas = segmentQuotas(opts.total ?? newPerDay());
  const last = await db.query.events.findFirst({
    where: eq(events.eventType, "outreach.batch_built"),
    orderBy: desc(events.occurredAt),
  });
  const cursors: Record<string, number> = {
    ...Object.fromEntries(SEGMENTS.map((s) => [s, 1])),
    ...(((last?.payload ?? {}) as { cursors?: Record<string, number> }).cursors ?? {}),
  };

  // Organizations already in a sequence — one person per company.
  const enrolledOrgSlugs = new Set(
    (
      await db
        .select({ name: accounts.name })
        .from(outreachEnrollments)
        .innerJoin(accounts, eq(accounts.id, outreachEnrollments.accountId))
    ).map((r) => slugify(r.name))
  );
  const enrolledPeople = new Set(
    (await db.select({ id: outreachEnrollments.apolloPersonId }).from(outreachEnrollments)).map((r) => r.id)
  );

  const created: Record<string, number> = {};
  let reveals = 0;
  let quotaHit = false;
  for (const segment of SEGMENTS) {
    created[segment] = 0;
    const want = quotas[segment];
    const cfg = SEGMENT_SEARCH[segment];
    for (let pageTry = 0; pageTry < 4 && created[segment] < want && !quotaHit; pageTry++) {
      const page = cursors[segment];
      let hits;
      try {
        hits = await searchTexasProspects({ ...cfg, page });
      } catch (err) {
        if (err instanceof FinderQuotaError) {
          quotaHit = true;
          break;
        }
        throw err;
      }
      // Wrap to page 1 at the end of the list; new people appear over time.
      cursors[segment] = hits.length < 25 ? 1 : page + 1;
      for (const hit of hits) {
        if (created[segment] >= want) break;
        if (!hit.hasEmail || !hit.orgName || SKIP_ORG.test(hit.orgName)) continue;
        if (enrolledPeople.has(hit.id) || enrolledOrgSlugs.has(slugify(hit.orgName))) continue;
        if (reveals >= want * 3 + 4) break; // credit guard per group per day
        let person;
        try {
          reveals++;
          person = await revealApolloPerson(hit.id);
        } catch (err) {
          if (err instanceof FinderQuotaError) {
            quotaHit = true;
            break;
          }
          throw err;
        }
        enrolledPeople.add(hit.id);
        // Deliverability: only Apollo-verified addresses, only people in Texas.
        // Rejects are remembered so the same person is never revealed (paid) twice.
        const skip = !person?.email
          ? "no email"
          : person.emailStatus !== "verified"
            ? `email ${person.emailStatus ?? "unverified"}`
            : person.state && !/^(texas|tx)$/i.test(person.state)
              ? `based in ${person.state}`
              : null;
        if (skip || !person?.email) {
          await db
            .insert(outreachEnrollments)
            .values({
              segment,
              market: marketForCity(person?.city),
              email: "",
              apolloPersonId: hit.id,
              status: "skipped",
              stopReason: skip ?? "no email",
            })
            .onConflictDoNothing();
          continue;
        }
        const email = person.email.toLowerCase();
        const already = await db.query.outreachEnrollments.findFirst({
          where: eq(outreachEnrollments.email, email),
        });
        const emailedBefore = await db
          .select({ id: interactions.id })
          .from(interactions)
          .innerJoin(contacts, eq(contacts.id, interactions.contactId))
          .where(and(sql`lower(${contacts.email}) = ${email}`, eq(interactions.direction, "outbound")))
          .limit(1);
        if (already || emailedBefore.length) continue;

        const orgName = person.orgName || hit.orgName;
        const { account } = await createAccount(db, {
          name: orgName,
          accountType: cfg.accountType,
          website: person.orgDomain ?? undefined,
          actor: "system",
        });
        enrolledOrgSlugs.add(slugify(hit.orgName));
        enrolledOrgSlugs.add(slugify(orgName));
        const existing = await db.query.outreachEnrollments.findFirst({
          where: eq(outreachEnrollments.accountId, account.id),
        });
        if (existing) continue;
        const [contact] = await db
          .insert(contacts)
          .values({
            accountId: account.id,
            firstName: person.firstName,
            lastName: person.lastName,
            title: person.title ?? hit.title,
            email,
            linkedinUrl: person.linkedinUrl,
            source: "apollo_prospecting",
            verifiedAt: new Date(),
            emailLookupAt: new Date(),
          })
          .returning();
        const [enrollment] = await db
          .insert(outreachEnrollments)
          .values({
            accountId: account.id,
            contactId: contact.id,
            segment,
            market: marketForCity(person.city),
            email,
            apolloPersonId: hit.id,
          })
          .returning();
        await draftTouch(db, enrollment, 1);
        created[segment]++;
      }
    }
  }

  await emitEvent(db, {
    eventType: "outreach.batch_built",
    payload: { cursors, created, reveals, quotaHit },
  });
  return { created, reveals, quotaHit };
}

/** Draft follow-ups that are due (3 and 7 business days after email 1 sent). */
export async function draftDueSequenceFollowups(db: Db): Promise<number> {
  const active = await db.query.outreachEnrollments.findMany({
    where: and(eq(outreachEnrollments.status, "active"), inArray(outreachEnrollments.lastStepSent, [1, 2])),
  });
  let drafted = 0;
  for (const e of active) {
    if (!e.firstSentAt) continue;
    const next = (e.lastStepSent + 1) as 2 | 3;
    const due = addBusinessDays(e.firstSentAt, FOLLOWUP_OFFSETS_BUSINESS_DAYS[next]);
    if (due.getTime() > Date.now()) continue;
    const exists = await db
      .select({ id: approvals.id })
      .from(approvals)
      .where(
        and(
          eq(approvals.approvalType, "sequence_email"),
          sql`${approvals.payload}->>'enrollmentId' = ${e.id}`,
          sql`(${approvals.payload}->>'step')::int = ${next}`
        )
      )
      .limit(1);
    if (exists.length) continue;
    if (await draftTouch(db, e, next)) drafted++;
  }
  return drafted;
}

/** Called by the guarded send layer after a sequence email actually leaves. */
export async function markSequenceSent(db: Db, enrollmentId: string, step: number, subject: string) {
  const e = await db.query.outreachEnrollments.findFirst({ where: eq(outreachEnrollments.id, enrollmentId) });
  if (!e) return;
  const now = new Date();
  await db
    .update(outreachEnrollments)
    .set({
      lastStepSent: Math.max(e.lastStepSent, step),
      lastSentAt: now,
      ...(step === 1 ? { firstSentAt: now, threadSubject: subject } : {}),
      ...(step >= 3 && e.status === "active" ? { status: "completed" } : {}),
      updatedAt: now,
    })
    .where(eq(outreachEnrollments.id, enrollmentId));
}

/** End a sequence: any pending or queued follow-up for it is withdrawn. */
export async function stopEnrollment(
  db: Db,
  enrollmentId: string,
  status: "replied" | "bounced" | "stopped",
  reason: string
) {
  await db
    .update(outreachEnrollments)
    .set({ status, stopReason: reason, updatedAt: new Date() })
    .where(eq(outreachEnrollments.id, enrollmentId));
  const open = await db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.approvalType, "sequence_email"),
        sql`${approvals.payload}->>'enrollmentId' = ${enrollmentId}`,
        inArray(approvals.status, ["pending", "approved", "edited"]),
        sql`${approvals.payload}->>'sentAt' is null`
      )
    );
  for (const a of open) {
    await db
      .update(approvals)
      .set({
        status: "superseded",
        resolvedAt: new Date(),
        resolvedBy: "system",
        payload: sql`${approvals.payload} - 'queuedSend'`,
      })
      .where(eq(approvals.id, a.id));
  }
}

const FREEMAIL = /@(gmail|yahoo|outlook|hotmail|aol|icloud|live|msn)\./i;

/**
 * Inbound mail on ray@htxsigncrafters.com (via the Gmail → Resend forward).
 * A reply from someone in a sequence stops it — for everyone at that company
 * when it comes from their work domain — and lands in History. Bounces stop
 * the bounced address. Returns true when the message was handled here.
 */
export async function handleOutreachInbound(
  db: Db,
  msg: { from: string; subject: string; text: string }
): Promise<boolean> {
  const fromEmail = (msg.from.match(/[^\s<>"]+@[^\s<>"]+/)?.[0] ?? "").toLowerCase();
  if (!fromEmail || fromEmail === (process.env.SEND_FROM_EMAIL ?? "").toLowerCase()) return false;

  if (/mailer-daemon|postmaster/i.test(fromEmail) || /undeliver|delivery status|returned mail/i.test(msg.subject)) {
    const candidates = await db.query.outreachEnrollments.findMany({
      where: inArray(outreachEnrollments.status, ["active", "completed"]),
    });
    const hit = candidates.find((e) => msg.text.toLowerCase().includes(e.email));
    if (!hit) return false;
    await stopEnrollment(db, hit.id, "bounced", `Bounced: ${msg.subject.slice(0, 120)}`);
    await logActivity(db, {
      entityType: "account",
      entityId: hit.accountId ?? hit.id,
      action: "outreach.bounced",
      detail: `${hit.email} bounced — sequence stopped`,
      actor: "integration",
    });
    return true;
  }

  let matches = await db.query.outreachEnrollments.findMany({
    where: eq(outreachEnrollments.email, fromEmail),
  });
  const domain = fromEmail.split("@")[1];
  if (!matches.length && domain && !FREEMAIL.test(fromEmail)) {
    matches = await db.query.outreachEnrollments.findMany({
      where: sql`split_part(${outreachEnrollments.email}, '@', 2) = ${domain}`,
    });
  }
  if (!matches.length) return false;

  for (const e of matches) {
    if (e.status === "active" || e.status === "completed") {
      await stopEnrollment(db, e.id, "replied", `Reply from ${fromEmail}`);
    }
  }
  const first = matches[0];
  await db.insert(interactions).values({
    accountId: first.accountId,
    contactId: matches.find((m) => m.email === fromEmail)?.contactId ?? first.contactId,
    type: "email",
    direction: "inbound",
    subject: msg.subject,
    summary: msg.text.slice(0, 1000),
    source: "outreach_reply",
  });
  if (first.accountId) {
    await logActivity(db, {
      entityType: "account",
      entityId: first.accountId,
      action: "outreach.replied",
      detail: `Reply from ${fromEmail}: ${msg.subject}`,
      actor: "integration",
    });
  }
  await emitEvent(db, {
    eventType: "outreach.replied",
    accountId: first.accountId ?? undefined,
    payload: { from: fromEmail, subject: msg.subject },
  });
  return true;
}

/** Outbox scoreboard for the Texas lane. */
export async function outreachStats(db: Db) {
  const rows = await db
    .select({ status: outreachEnrollments.status, sent: outreachEnrollments.lastStepSent })
    .from(outreachEnrollments)
    .where(sql`${outreachEnrollments.status} <> 'skipped'`);
  return {
    people: rows.length,
    emailed: rows.filter((r) => r.sent > 0).length,
    replied: rows.filter((r) => r.status === "replied").length,
    bounced: rows.filter((r) => r.status === "bounced").length,
  };
}
