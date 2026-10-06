import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import { approvals, outreachEnrollments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  setProspectSearchForTests,
  setPeopleSearchForTests,
  type ProspectQuery,
  type RevealedPerson,
} from "@/lib/integrations/email-finder/client";
import {
  buildDailyOutreachBatch,
  draftDueSequenceFollowups,
  handleOutreachInbound,
  markSequenceSent,
  marketForCity,
  segmentQuotas,
} from "./prospecting";
import { TEMPLATES, renderTouch, type Segment } from "./templates";

let db: Db;

const PEOPLE: Record<string, RevealedPerson & { seg: string; org: string }> = {
  p1: { seg: "estimator", org: "Gage Commercial Construction, LLC", firstName: "Edward", lastName: "Baca", title: "Estimator", email: "edward@gagecc.com", emailStatus: "verified", city: "Dallas", state: "Texas", orgName: "Gage Commercial Construction, LLC", orgDomain: "gagecc.com", linkedinUrl: null },
  p2: { seg: "estimator", org: "Gage Commercial Construction, LLC", firstName: "Lane", lastName: "Cole", title: "Estimator", email: "lane@gagecc.com", emailStatus: "verified", city: "Dallas", state: "Texas", orgName: "Gage Commercial Construction, LLC", orgDomain: "gagecc.com", linkedinUrl: null },
  p3: { seg: "estimator", org: "Ridgemont Commercial", firstName: "Dan", lastName: "Riley", title: "Chief Estimator", email: "dan@ridgemont.com", emailStatus: "guessed", city: "Houston", state: "Texas", orgName: "Ridgemont Commercial", orgDomain: "ridgemont.com", linkedinUrl: null },
  p4: { seg: "estimator", org: "Lone Star Signs", firstName: "Sam", lastName: "Lee", title: "Estimator", email: "sam@lonestarsigns.com", emailStatus: "verified", city: "Houston", state: "Texas", orgName: "Lone Star Signs", orgDomain: "lonestarsigns.com", linkedinUrl: null },
  p5: { seg: "property manager", org: "Merit Commercial Real Estate", firstName: "Amanda", lastName: "Ruiz", title: "Director of Property Management", email: "amanda@meritcre.com", emailStatus: "verified", city: "Katy", state: "Texas", orgName: "Merit Commercial Real Estate", orgDomain: "meritcre.com", linkedinUrl: null },
};

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
  setProspectSearchForTests(async (q: ProspectQuery) =>
    q.page > 1
      ? []
      : Object.entries(PEOPLE)
          .filter(([, p]) => q.titles.includes(p.seg))
          .map(([id, p]) => ({ id, firstName: p.firstName, title: p.title, hasEmail: true, orgName: p.org }))
  );
  setPeopleSearchForTests(null, async (id) => PEOPLE[id] ?? null);
});

afterEach(() => {
  setProspectSearchForTests(null);
  setPeopleSearchForTests(null);
});

describe("approved templates", () => {
  it("every touch renders with no leftover merge fields, the street address, and no em dashes", () => {
    for (const segment of Object.keys(TEMPLATES) as Segment[]) {
      for (const step of [1, 2, 3] as const) {
        const { subject, body } = renderTouch({ segment, step, firstName: "Edward", company: "Gage Commercial Construction, LLC", market: "dfw" });
        expect(body + subject).not.toMatch(/\{\{|\}\}/);
        expect(body).toContain("1359 E 40th St, Houston, TX 77022");
        expect(body + subject).not.toContain("—");
        expect(body).not.toMatch(/outsourc/i);
        if (step > 1) expect(subject.startsWith("Re: ")).toBe(true);
      }
    }
  });

  it("company suffixes come off so the sentence reads naturally", () => {
    const { body } = renderTouch({ segment: "gc", step: 1, firstName: "Edward", company: "Gage Commercial Construction, LLC", market: "houston" });
    expect(body).toContain("get on Gage Commercial Construction's bid list");
    expect(body).toContain("We're a Houston shop.");
  });

  it("maps cities to the approved local line markets", () => {
    expect(marketForCity("Sugar Land")).toBe("houston");
    expect(marketForCity("Round Rock")).toBe("austin");
    expect(marketForCity("New Braunfels")).toBe("san_antonio");
    expect(marketForCity("Plano")).toBe("dfw");
    expect(marketForCity("Lubbock")).toBe("texas");
  });

  it("daily quotas add up and favor contractors", () => {
    const q = segmentQuotas(15);
    expect(Object.values(q).reduce((a, b) => a + b, 0)).toBe(15);
    expect(q.gc).toBeGreaterThan(q.architect);
  });
});

describe("daily batch", () => {
  it("enrolls one verified person per company, skips sign companies and unverified emails, drafts email 1", async () => {
    const r = await buildDailyOutreachBatch(db, { total: 20 });
    const rows = await db.select().from(outreachEnrollments);
    const active = rows.filter((e) => e.status === "active");
    expect(active.map((e) => e.email).sort()).toEqual(["amanda@meritcre.com", "edward@gagecc.com"]);
    expect(active.find((e) => e.email === "edward@gagecc.com")?.market).toBe("dfw");
    expect(rows.find((e) => e.apolloPersonId === "p3")?.status).toBe("skipped"); // guessed email
    expect(rows.some((e) => e.apolloPersonId === "p4")).toBe(false); // sign company, never revealed
    expect(r.created.gc).toBe(1);

    const drafts = await db.select().from(approvals).where(eq(approvals.approvalType, "sequence_email"));
    expect(drafts).toHaveLength(2);
    const gc = drafts.find((d) => (d.payload as { segment: string }).segment === "gc")!;
    const draft = (gc.payload as { draft: { subject: string; body: string; suggested_email: string } }).draft;
    expect(draft.subject).toBe("sign bids");
    expect(draft.body).toContain("We're a Houston shop and we take work all over Texas.");
    expect(draft.suggested_email).toBe("edward@gagecc.com");

    // Second run the same day: nobody is revealed or enrolled twice.
    const again = await buildDailyOutreachBatch(db, { total: 20 });
    expect(again.reveals).toBe(0);
  });

  it("drafts follow-ups in the same thread once due, and a reply stops the sequence", async () => {
    await buildDailyOutreachBatch(db, { total: 20 });
    const e = (await db.select().from(outreachEnrollments).where(eq(outreachEnrollments.email, "edward@gagecc.com")))[0];
    await markSequenceSent(db, e.id, 1, "sign bids");
    // Not due yet (sent just now).
    expect(await draftDueSequenceFollowups(db)).toBe(0);
    await db
      .update(outreachEnrollments)
      .set({ firstSentAt: new Date(Date.now() - 10 * 86400000) })
      .where(eq(outreachEnrollments.id, e.id));
    expect(await draftDueSequenceFollowups(db)).toBe(1);
    expect(await draftDueSequenceFollowups(db)).toBe(0); // no duplicate draft
    const fu = (await db.select().from(approvals).where(eq(approvals.approvalType, "sequence_email"))).find(
      (a) => (a.payload as { step: number }).step === 2
    )!;
    expect((fu.payload as { draft: { subject: string } }).draft.subject).toBe("Re: sign bids");

    // A colleague at the same company replies: the sequence stops, the draft is withdrawn.
    const handled = await handleOutreachInbound(db, {
      from: "Pat Gage <pat@gagecc.com>",
      subject: "Re: sign bids",
      text: "Added you to our list.",
    });
    expect(handled).toBe(true);
    const after = await db.query.outreachEnrollments.findFirst({ where: eq(outreachEnrollments.id, e.id) });
    expect(after?.status).toBe("replied");
    const withdrawn = await db.query.approvals.findFirst({ where: eq(approvals.id, fu.id) });
    expect(withdrawn?.status).toBe("superseded");
  });

  it("a bounce stops the bounced address; our own BCC copies are ignored", async () => {
    await buildDailyOutreachBatch(db, { total: 20 });
    process.env.SEND_FROM_EMAIL = "ray@htxsigncrafters.com";
    expect(await handleOutreachInbound(db, { from: "ray@htxsigncrafters.com", subject: "sign bids", text: "" })).toBe(false);
    const bounced = await handleOutreachInbound(db, {
      from: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>",
      subject: "Delivery Status Notification (Failure)",
      text: "Your message to amanda@meritcre.com couldn't be delivered.",
    });
    expect(bounced).toBe(true);
    const row = await db.query.outreachEnrollments.findFirst({ where: eq(outreachEnrollments.email, "amanda@meritcre.com") });
    expect(row?.status).toBe("bounced");
  });
});
