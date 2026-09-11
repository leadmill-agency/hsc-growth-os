// One-off (2026-09-11): researched accounts have no website on file, which
// starves every Hunter lookup. Step 1: resolve each account's official domain
// from its research brief + sources (small-model pass). Step 2: spend the
// Hunter budget on the primary contact of each account that now has a domain.
//   npx tsx scripts/backfill-domains-and-emails.ts [maxLookups]
import { readFileSync } from "node:fs";
import { z } from "zod";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const maxLookups = Number(process.argv[2] ?? 15);
  const { getDb } = await import("../src/lib/db/client");
  const { accounts, contacts, opportunities, evidence } = await import("../src/lib/db/schema");
  const { and, eq, inArray, isNull, sql } = await import("drizzle-orm");
  const { getLLMClient } = await import("../src/lib/ai/client");
  const { findWorkEmail } = await import("../src/lib/integrations/email-finder/client");
  const db = await getDb();

  const rows = await db
    .select({ id: accounts.id, name: accounts.name, website: accounts.website })
    .from(accounts)
    .innerJoin(opportunities, eq(opportunities.accountId, accounts.id))
    .where(and(inArray(opportunities.stage, ["researched", "pursuing"]), isNull(accounts.website)))
    .groupBy(accounts.id);
  console.log(`${rows.length} researched accounts missing a website`);

  const llm = getLLMClient();
  const domainSchema = z.object({ official_website: z.string().nullable() });
  for (const acc of rows) {
    const briefRow = await db.query.evidence.findFirst({
      where: and(
        eq(evidence.entityType, "account"),
        eq(evidence.entityId, acc.id),
        eq(evidence.fieldName, "research_brief")
      ),
    });
    if (!briefRow) continue;
    const brief = briefRow.value as { who_they_are?: string; about?: string; sources?: string[] };
    try {
      const out = await llm.generateStructured({
        system:
          "Identify the company's OWN official website from the research. Rules: it must " +
          "plausibly be the company's own domain (never LinkedIn, Yelp, Facebook, news sites, " +
          "government portals, directories). Prefer a URL present in SOURCES. If nothing is " +
          "clearly the company's own site, return null — never guess a domain into existence.",
        prompt:
          `COMPANY: ${acc.name}\n\nABOUT: ${brief.who_they_are ?? brief.about ?? ""}\n\n` +
          `SOURCES:\n${(brief.sources ?? []).join("\n")}`,
        schema: domainSchema,
        effort: "low",
      });
      if (out.official_website) {
        const domain = out.official_website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0];
        await db
          .update(accounts)
          .set({ website: out.official_website, domain, updatedAt: new Date() })
          .where(eq(accounts.id, acc.id));
        console.log(` domain: ${acc.name} → ${domain}`);
      } else {
        console.log(` no site found: ${acc.name}`);
      }
    } catch (err) {
      console.log(` FAILED ${acc.name}: ${(err as Error).message.slice(0, 80)}`);
    }
  }

  // Step 2: Hunter on the primary contact of each account with a domain,
  // best opportunities first, capped to protect the free tier.
  const targets = await db
    .select({
      accountId: accounts.id,
      name: accounts.name,
      domain: accounts.domain,
      score: sql<number>`max(coalesce(${opportunities.overallScore}, ${opportunities.fitScore}, 0))`,
    })
    .from(accounts)
    .innerJoin(opportunities, eq(opportunities.accountId, accounts.id))
    .where(and(inArray(opportunities.stage, ["researched", "pursuing"]), sql`${accounts.domain} is not null`))
    .groupBy(accounts.id)
    .orderBy(sql`4 desc`);
  let used = 0;
  for (const t of targets) {
    if (used >= maxLookups) break;
    const person = await db.query.contacts.findFirst({
      where: and(eq(contacts.accountId, t.accountId), isNull(contacts.email)),
      orderBy: (c, { desc: d }) => [d(c.influenceScore)],
    });
    if (!person) continue;
    const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
    if (!fullName || !fullName.includes(" ")) continue; // need a full name
    used++;
    try {
      const found = await findWorkEmail({ fullName, domain: t.domain!, company: t.name });
      if (found) {
        await db
          .update(contacts)
          .set({ email: found.email, source: `hunter (${found.confidence}% confidence)`, updatedAt: new Date() })
          .where(eq(contacts.id, person.id));
        console.log(` EMAIL: ${t.name} — ${fullName} → ${found.email} (${found.confidence}%)`);
      } else {
        console.log(` no email: ${t.name} — ${fullName} at ${t.domain}`);
      }
    } catch (err) {
      console.log(` FAILED ${t.name}/${fullName}: ${(err as Error).message.slice(0, 80)}`);
    }
  }
  console.log(`Hunter lookups used this run: ${used}/${maxLookups}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
