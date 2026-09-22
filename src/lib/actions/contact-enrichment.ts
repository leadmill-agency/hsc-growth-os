import type { Db } from "@/lib/db/client";
import { accounts, contacts, opportunities } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logActivity } from "@/lib/events";

// Proactive contact enrichment (Rameel 2026-09-21: Stretch Zone's targets sat
// as "no email found" when Apollo had 5 of 7 on the first try — nobody had
// looked). Every scheduler tick, contacts on ACTIVE researched companies get
// an Apollo→Hunter lookup, a few per tick to respect rate limits. Each contact
// is looked up ONCE (emailLookupAt marks the attempt) — the paste-email field
// and the Find email button remain the manual paths afterward.

export async function enrichResearchedContacts(db: Db, limit = 6): Promise<number> {
  const activeOpps = await db.query.opportunities.findMany({
    where: inArray(opportunities.stage, ["researching", "researched", "pursuing"]),
    columns: { accountId: true },
    limit: 200,
  });
  const accountIds = [...new Set(activeOpps.map((o) => o.accountId).filter((x): x is string => !!x))];
  if (accountIds.length === 0) return 0;

  // CREDIT DISCIPLINE (Rameel 2026-09-21): auto-enrichment aims for TWO
  // reachable people per company, not every stored name — the rest stay
  // on-demand (Write email tries four; the chip has Find/paste). Roughly
  // halves Apollo credit burn across the backlog.
  const allForAccounts = await db.query.contacts.findMany({
    where: inArray(contacts.accountId, accountIds),
    orderBy: (c, { desc: d }) => [d(c.influenceScore)],
  });
  const byAccount = new Map<string, typeof allForAccounts>();
  for (const c of allForAccounts) {
    const list = byAccount.get(c.accountId!) ?? [];
    list.push(c);
    byAccount.set(c.accountId!, list);
  }
  const pending: typeof allForAccounts = [];
  for (const list of byAccount.values()) {
    const covered = list.filter((c) => c.email).length;
    if (covered >= 2) continue;
    pending.push(...list.filter((c) => !c.email && !c.emailLookupAt).slice(0, 2 - covered));
  }
  pending.splice(limit);
  if (pending.length === 0) return 0;

  const acctRows = await db.query.accounts.findMany({
    where: inArray(accounts.id, [...new Set(pending.map((c) => c.accountId!))]),
  });
  const acctById = new Map(acctRows.map((a) => [a.id, a]));
  const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");

  let found = 0;
  for (const c of pending) {
    const acct = acctById.get(c.accountId!);
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
    const domain =
      acct?.domain ?? acct?.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    let email: string | null = null;
    if (name && (domain || acct?.name)) {
      try {
        const { FinderQuotaError } = await import("@/lib/integrations/email-finder/client");
        void FinderQuotaError;
        const f = await findWorkEmail({ fullName: name, domain, company: acct?.name });
        // Guard against stale org charts: an address on a DIFFERENT domain
        // than the company's means the person likely moved on — don't store
        // an email that would cold-call a stranger about the wrong company.
        if (f && (!domain || f.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`))) {
          email = f.email;
        } else if (f) {
          await logActivity(db, {
            entityType: "contact",
            entityId: c.id,
            action: "contact.moved_on",
            detail: `${name} — finder returned an address at a different company (${f.email.split("@")[1]}); likely no longer at ${acct?.name}`,
            actor: "system",
          });
        }
      } catch (err) {
        const { FinderQuotaError } = await import("@/lib/integrations/email-finder/client");
        if (err instanceof FinderQuotaError) {
          // Out of credits ≠ "no email exists": stop the pass WITHOUT marking
          // this contact attempted, so it retries when credits refresh.
          console.warn(`[enrichment] ${err.message} — pausing pass`);
          return found;
        }
        // other finder errors are best-effort
      }
    }
    await db
      .update(contacts)
      .set({ emailLookupAt: new Date(), ...(email ? { email } : {}), updatedAt: new Date() })
      .where(eq(contacts.id, c.id));
    if (email) found++;
  }
  return found;
}

// Titles that buy signs, by what kind of company it is. Apollo matches these
// as partial title strings.
const DISCOVERY_TITLES: Record<string, string[]> = {
  franchise: ["Director of Real Estate", "Franchise Development", "Director of Construction", "Real Estate Manager"],
  franchisee: ["Owner", "Director of Operations", "Construction Manager"],
  developer: ["Director of Development", "Development Manager", "Leasing", "Construction Manager"],
  property_owner: ["Director of Real Estate", "Property Manager", "Asset Manager"],
  property_manager: ["Property Manager", "Facilities", "Regional Manager"],
  general_contractor: ["Estimator", "Preconstruction", "Project Manager", "Purchasing"],
  facility_operator: ["Director of Construction", "Director of Real Estate", "Facilities", "Development"],
  default: ["Owner", "Director of Real Estate", "Director of Construction", "Operations Manager"],
};

/**
 * For active companies where nobody reachable exists (no stored contact has an
 * email and every lookup already ran — or research never named a person at
 * all), ask Apollo WHO the decision-makers are, store them as contacts, and
 * let the normal email lookup reveal their addresses. Once per account.
 */
export async function discoverContactsForUncovered(db: Db, limit = 3): Promise<number> {
  const { activities } = await import("@/lib/db/schema");
  const activeOpps = await db.query.opportunities.findMany({
    where: inArray(opportunities.stage, ["researching", "researched", "pursuing"]),
    columns: { accountId: true },
    limit: 200,
  });
  const accountIds = [...new Set(activeOpps.map((o) => o.accountId).filter((x): x is string => !!x))];
  if (accountIds.length === 0) return 0;

  const allContacts = await db.query.contacts.findMany({
    where: inArray(contacts.accountId, accountIds),
  });
  const byAccount = new Map<string, typeof allContacts>();
  for (const c of allContacts) {
    const list = byAccount.get(c.accountId!) ?? [];
    list.push(c);
    byAccount.set(c.accountId!, list);
  }
  // Uncovered = nothing reachable AND nothing still awaiting a lookup.
  const uncovered = accountIds.filter((id) => {
    const list = byAccount.get(id) ?? [];
    return !list.some((c) => c.email) && !list.some((c) => !c.email && !c.emailLookupAt);
  });
  if (uncovered.length === 0) return 0;

  const searched = await db.query.activities.findMany({
    where: and(eq(activities.action, "apollo.people_searched"), inArray(activities.entityId, uncovered)),
    columns: { entityId: true },
  });
  const alreadySearched = new Set(searched.map((a) => a.entityId));
  const todo = uncovered.filter((id) => !alreadySearched.has(id)).slice(0, limit);
  if (todo.length === 0) return 0;

  const acctRows = await db.query.accounts.findMany({ where: inArray(accounts.id, todo) });
  const { searchPeopleAtCompany, revealApolloPerson, FinderQuotaError } = await import(
    "@/lib/integrations/email-finder/client"
  );
  let created = 0;
  for (const acct of acctRows) {
    const domain =
      acct.domain ?? acct.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const titles = DISCOVERY_TITLES[acct.accountType ?? ""] ?? DISCOVERY_TITLES.default;
    let found = 0;
    try {
      const candidates = await searchPeopleAtCompany({ domain, company: acct.name, titles, limit: 5 });
      // Reveal by id (this is the credit spend): emailable people first, two
      // per company.
      const ordered = [...candidates].sort((a, b) => Number(b.hasEmail) - Number(a.hasEmail));
      const existingNames = new Set(
        (byAccount.get(acct.id) ?? []).map((c) =>
          [c.firstName, c.lastName].filter(Boolean).join(" ").toLowerCase()
        )
      );
      for (const cand of ordered) {
        if (found >= 2) break;
        const person = await revealApolloPerson(cand.id);
        if (!person) continue;
        const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ");
        if (existingNames.has(fullName.toLowerCase())) continue;
        // Moved-on guard: an email on a different domain than the company's
        // means Apollo's org data is stale — store the person, not the email.
        const emailOk =
          person.email && (!domain || person.email.toLowerCase().endsWith(`@${domain.toLowerCase()}`));
        await db.insert(contacts).values({
          accountId: acct.id,
          firstName: person.firstName,
          lastName: person.lastName,
          title: person.title ?? cand.title,
          email: emailOk ? person.email : null,
          linkedinUrl: person.linkedinUrl,
          source: "apollo_search",
          influenceScore: 70,
          emailLookupAt: new Date(),
        });
        created++;
        found++;
      }
    } catch (err) {
      if (err instanceof FinderQuotaError) {
        console.warn(`[discovery] ${err.message} — pausing`);
        return created;
      }
    }
    await logActivity(db, {
      entityType: "account",
      entityId: acct.id,
      action: "apollo.people_searched",
      detail:
        found > 0
          ? `Apollo found ${found} decision-maker(s) at ${acct.name} by title (${titles.slice(0, 2).join(", ")}…)`
          : `Apollo has nobody matching ${titles.slice(0, 2).join("/")} at ${acct.name}`,
      actor: "system",
    });
  }
  return created;
}
