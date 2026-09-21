import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import { createAccount, createOpportunity } from "./entities";
import { opportunities } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// One radar card per company (Rameel 2026-09-19): the scout re-tells the same
// story daily with new wording, which defeated (account, project) dedupe —
// dismissed companies kept re-entering the inbox as fresh cards.

let db: Db;

beforeEach(async () => {
  process.env.PGLITE_MEMORY = "true";
  resetDbForTests();
  db = await getDb();
});

afterEach(() => {
  resetDbForTests();
});

describe("account name-variant dedupe", () => {
  it("LLM name variants resolve to the SAME account (the DECA Dental leak)", async () => {
    const { account: a } = await createAccount(db, { name: "Ideal Dental (DECA Dental)" });
    const { account: b, created } = await createAccount(db, {
      name: "Ideal Dental (DECA Dental Group)",
    });
    expect(created).toBe(false);
    expect(b.id).toBe(a.id);
  });

  it("different companies sharing a word do NOT merge", async () => {
    const { account: a } = await createAccount(db, { name: "Swish Dental" });
    const { account: b, created } = await createAccount(db, { name: "Smile Dental" });
    expect(created).toBe(true);
    expect(b.id).not.toBe(a.id);
  });
});

describe("account-wide opportunity dedupe", () => {
  it("a dismissed company never gets a second radar card, whatever the project variant", async () => {
    const { account } = await createAccount(db, { name: "Freddy's Frozen Custard" });
    const { opportunity: first } = await createOpportunity(db, {
      name: "Freddy's — 8-unit deal",
      accountId: account.id,
      stage: "discovered",
      source: "web_scout",
      dedupeAccountWide: true,
    });
    await db
      .update(opportunities)
      .set({ stage: "dismissed" })
      .where(eq(opportunities.id, first.id));

    const { opportunity: again, created } = await createOpportunity(db, {
      name: "Freddy's — Eight-unit franchise agreement (Arkansas & Texas)",
      accountId: account.id,
      stage: "discovered",
      source: "web_scout",
      dedupeAccountWide: true,
    });
    expect(created).toBe(false);
    expect(again.id).toBe(first.id);
    expect(again.stage).toBe("dismissed");
    const all = await db.query.opportunities.findMany({
      where: eq(opportunities.accountId, account.id),
    });
    expect(all).toHaveLength(1);
  });

  it("a re-sighting attaches to the ACTIVE card when the company has both active and dismissed", async () => {
    const { account } = await createAccount(db, { name: "Integrity Urgent Care" });
    const { opportunity: dismissed } = await createOpportunity(db, {
      name: "Integrity — Huntsville clinic",
      accountId: account.id,
      stage: "discovered",
      dedupeAccountWide: true,
    });
    await db
      .update(opportunities)
      .set({ stage: "dismissed" })
      .where(eq(opportunities.id, dismissed.id));
    // An active card created later (e.g. user pursued a different sighting)
    const [active] = await db
      .insert(opportunities)
      .values({ name: "Integrity — Murphy clinic", accountId: account.id, stage: "researching" })
      .returning();

    const { opportunity: hit, created } = await createOpportunity(db, {
      name: "Integrity — Ribbon cutting for Murphy location",
      accountId: account.id,
      stage: "discovered",
      dedupeAccountWide: true,
    });
    expect(created).toBe(false);
    expect(hit.id).toBe(active.id);
  });

  it("suppression expires: a company dismissed 90+ days ago earns a fresh card", async () => {
    const { account } = await createAccount(db, { name: "Chama Gaucha" });
    const { opportunity: old } = await createOpportunity(db, {
      name: "Chama Gaucha — Katy unit",
      accountId: account.id,
      stage: "discovered",
      dedupeAccountWide: true,
    });
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 3600 * 1000);
    await db
      .update(opportunities)
      .set({ stage: "dismissed", updatedAt: hundredDaysAgo })
      .where(eq(opportunities.id, old.id));

    const { opportunity: fresh, created } = await createOpportunity(db, {
      name: "Chama Gaucha — new Woodlands unit",
      accountId: account.id,
      stage: "discovered",
      dedupeAccountWide: true,
    });
    expect(created).toBe(true);
    expect(fresh.id).not.toBe(old.id);
  });

  it("bids stay one card per project (flag not set): same GC, different projects", async () => {
    const { account } = await createAccount(db, { name: "Embree Construction Group" });
    const mk = async (proj: string) => {
      const [p] = await db
        .insert((await import("@/lib/db/schema")).projects)
        .values({ name: proj })
        .returning();
      return createOpportunity(db, {
        name: `Embree — ${proj} (bid)`,
        accountId: account.id,
        projectId: p.id,
        stage: "bid_invited",
        source: "email_inbound",
      });
    };
    const a = await mk("Oakwood Medical Renovation");
    await db
      .update(opportunities)
      .set({ stage: "dismissed" })
      .where(eq(opportunities.id, a.opportunity.id));
    const b = await mk("Cava Sunkissed - Pearland");
    expect(b.created).toBe(true);
    expect(b.opportunity.id).not.toBe(a.opportunity.id);
  });
});
