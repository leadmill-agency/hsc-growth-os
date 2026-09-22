import type { Db } from "@/lib/db/client";
import { accounts, contacts, opportunities } from "@/lib/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logActivity } from "@/lib/events";
import { accountNameStems } from "@/lib/actions/entities";

// Proactive contact enrichment (Rameel 2026-09-21: Stretch Zone's targets sat
// as "no email found" when Apollo had 5 of 7 on the first try — nobody had
// looked). Every scheduler tick, contacts on ACTIVE researched companies get
// an Apollo→Hunter lookup, a few per tick to respect rate limits. Each contact
// is looked up ONCE (emailLookupAt marks the attempt) — the paste-email field
// and the Find email button remain the manual paths afterward.

/** Is this found email really at THIS company? Website and mail domains often
 *  differ (twinpeaksrestaurant.com site, tprest.com mail), so Apollo's org
 *  match outranks the domain comparison, and a mail domain other contacts at
 *  the account already use is trusted. */
export function emailBelongsToCompany(
  account: { name: string; domain?: string | null },
  found: { email: string; orgName?: string | null; orgDomain?: string | null },
  knownMailDomains: Set<string>
): boolean {
  const mailDomain = found.email.toLowerCase().split("@")[1] ?? "";
  if (account.domain && mailDomain === account.domain.toLowerCase()) return true;
  if (knownMailDomains.has(mailDomain)) return true;
  if (found.orgDomain && account.domain && found.orgDomain.toLowerCase() === account.domain.toLowerCase())
    return true;
  if (found.orgName) {
    const a = accountNameStems(account.name);
    const b = accountNameStems(found.orgName);
    if (a.size >= 1 && b.size >= 1) {
      const [small, big] = a.size <= b.size ? [a, b] : [b, a];
      if ([...small].every((s) => big.has(s))) return true;
    }
    return false; // Apollo names a DIFFERENT company — the person moved on
  }
  // No org info from the provider: trust only a matching/known mail domain.
  return false;
}

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
  // The target is two FOUND addresses per company — attempts keep going down
  // the candidate list until that's met (a junk contact returning nothing must
  // not burn a slot; the Twin Peaks lesson, 2026-09-21). Reveals only charge
  // on success, so extra attempts are free.
  const pending: typeof allForAccounts = [];
  for (const list of byAccount.values()) {
    const covered = list.filter((c) => c.email).length;
    if (covered >= 2) continue;
    pending.push(...list.filter((c) => !c.email && !c.emailLookupAt));
  }
  pending.splice(limit);
  if (pending.length === 0) return 0;

  const acctRows = await db.query.accounts.findMany({
    where: inArray(accounts.id, [...new Set(pending.map((c) => c.accountId!))]),
  });
  const acctById = new Map(acctRows.map((a) => [a.id, a]));
  const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");

  // Corporate mail domains often differ from the website AND appear in the
  // research itself (Taco Palenque: site tacopalenque.com, mail
  // palenquegroup.com — the brief printed a palenquegroup.com address). Harvest
  // every domain the account's evidence mentions as lookup fallbacks.
  const { evidence } = await import("@/lib/db/schema");
  const evRows = await db.query.evidence.findMany({
    where: and(
      eq(evidence.entityType, "account"),
      inArray(evidence.entityId, [...acctById.keys()])
    ),
  });
  const briefDomainsByAccount = new Map<string, string[]>();
  for (const row of evRows) {
    const text = JSON.stringify(row.value ?? "");
    const domains = [...text.matchAll(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/g)].map((m) => m[1].toLowerCase());
    if (domains.length) {
      const list = briefDomainsByAccount.get(row.entityId) ?? [];
      briefDomainsByAccount.set(row.entityId, [...new Set([...list, ...domains])]);
    }
  }

  // (Firm-hint lookups removed 2026-09-21: Rameel — "I don't want architect
  // firms, those are never useful. It has to be someone at the company.")

  let found = 0;
  // Per-ACCOUNT batches with consensus (2026-09-21, the Twin Peaks lesson):
  // Apollo often returns an email without org context; when two people at the
  // same company resolve to the SAME unknown mail domain, that domain IS the
  // company's mail domain (twinpeaksrestaurant.com site, tprest.com mail) —
  // accept the batch instead of rejecting everyone one by one.
  const pendingByAccount = new Map<string, typeof pending>();
  for (const c of pending) {
    const list = pendingByAccount.get(c.accountId!) ?? [];
    list.push(c);
    pendingByAccount.set(c.accountId!, list);
  }
  const { FinderQuotaError } = await import("@/lib/integrations/email-finder/client");
  for (const [accountId, batch] of pendingByAccount) {
    const acct = acctById.get(accountId);
    const domain =
      acct?.domain ?? acct?.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const knownMailDomains = new Set(
      (byAccount.get(accountId) ?? [])
        .map((k) => k.email?.toLowerCase().split("@")[1])
        .filter((d): d is string => !!d)
    );
    const alreadyCovered = (byAccount.get(accountId) ?? []).filter((c) => c.email).length;
    type Result = { c: (typeof batch)[number]; f: Awaited<ReturnType<typeof findWorkEmail>> };
    const results: Result[] = [];
    try {
      let hits = alreadyCovered;
      for (const c of batch) {
        if (hits >= 2) break; // two found addresses is the target, not two tries
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
        if (!name || (!domain && !acct?.name)) {
          results.push({ c, f: null });
          continue;
        }
        let f = await findWorkEmail({ fullName: name, domain, company: acct?.name });
        const via: "firm" | undefined = undefined;
        void via;
        // Fallback: mail domains the research evidence itself mentions.
        if (!f) {
          for (const alt of (briefDomainsByAccount.get(accountId) ?? []).slice(0, 3)) {
            if (alt === domain) continue;
            f = await findWorkEmail({ fullName: name, domain: alt });
            if (f) {
              knownMailDomains.add(alt);
              break;
            }
          }
        }
        results.push({ c, f });
        if (f) hits++;
      }
    } catch (err) {
      if (err instanceof FinderQuotaError) {
        // Out of credits ≠ "no email exists": stop WITHOUT marking the batch
        // attempted, so it retries when credits refresh.
        console.warn(`[enrichment] ${err.message} — pausing pass`);
        return found;
      }
    }
    // Consensus: a mail domain two+ batch results share is the company's.
    const domainCounts = new Map<string, number>();
    for (const r of results) {
      const d = r.f?.email.toLowerCase().split("@")[1];
      if (d) domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
    for (const [d, n] of domainCounts) if (n >= 2) knownMailDomains.add(d);

    for (const { c, f } of results) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
      let email: string | null = null;
      if (f && acct && emailBelongsToCompany({ name: acct.name, domain }, f, knownMailDomains)) {
        email = f.email;
        knownMailDomains.add(f.email.toLowerCase().split("@")[1]);
      } else if (f) {
        await logActivity(db, {
          entityType: "contact",
          entityId: c.id,
          action: "contact.moved_on",
          detail: `${name} — finder returned an address at a different company (${f.email.split("@")[1]}); likely no longer at ${acct?.name}`,
          actor: "system",
        });
      }
      await db
        .update(contacts)
        .set({ emailLookupAt: new Date(), ...(email ? { email } : {}), updatedAt: new Date() })
        .where(eq(contacts.id, c.id));
      if (email) found++;
    }
  }
  return found;
}


// THE CONTACT RULE (Rameel 2026-09-21): a contact must be a PERSON who works
// AT the company. Firms-as-contacts (Interplan LLC), filing agents, outside
// architects/engineers/brokers, and corporate entities are never useful —
// they pollute cards and burn lookups.
const ENTITY_NAME = /\b(llc|inc|corp(oration)?|ltd|llp|l\.?p\.?|group|services?|company|co\.|holdings|architects?|engineering|design|associates|partners|enterprises|management|properties)\b/i;
const EXTERNAL_TITLE = /architect|\ba\/e\b|of record|design firm|engineer|leasing agent|listing agent|broker|attorney|filing|permit (agent|expeditor)|consultant \(/i;

export function isPersonAtCompany(contact: {
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
}): boolean {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  if (!name || !contact.lastName) return false; // entities land as one long "first name"
  if (ENTITY_NAME.test(name)) return false;
  if (contact.title && EXTERNAL_TITLE.test(contact.title)) return false;
  return true;
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
        // Moved-on guard, org-aware: reveal-by-id has no org context in our
        // read, but a mail domain other contacts already use is trusted.
        const knownMailDomains = new Set(
          (byAccount.get(acct.id) ?? [])
            .map((k) => k.email?.toLowerCase().split("@")[1])
            .filter((d): d is string => !!d)
        );
        const mailDomain = person.email?.toLowerCase().split("@")[1] ?? "";
        const emailOk =
          person.email &&
          (!domain || mailDomain === domain.toLowerCase() || knownMailDomains.has(mailDomain));
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

/**
 * Auto-dismiss researched cards with NO contact path (Rameel 2026-09-21: "if
 * Apollo comes up empty... I don't know what I'd do without the email").
 * Fires only after the whole chain is exhausted: contacts (if any) all looked
 * up with zero addresses AND Apollo people discovery already ran for the
 * account. Logged as opportunity.auto_dismissed — deliberately NOT
 * opportunity.dismissed, so the radar's learning only ever trains on human
 * judgments. The 90-day suppression applies as usual; a fresh signal after
 * that earns a fresh look.
 */
export async function autoDismissUnreachable(db: Db): Promise<number> {
  const { activities } = await import("@/lib/db/schema");
  const { notInArray, sql } = await import("drizzle-orm");
  const researched = await db.query.opportunities.findMany({
    where: and(
      eq(opportunities.stage, "researched"),
      notInArray(sql`coalesce(${opportunities.opportunityType}, '')`, ["incoming_bid", "bid"])
    ),
    limit: 200,
  });
  const accountIds = [...new Set(researched.map((o) => o.accountId).filter((x): x is string => !!x))];
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
  const searched = await db.query.activities.findMany({
    where: and(eq(activities.action, "apollo.people_searched"), inArray(activities.entityId, accountIds)),
    columns: { entityId: true },
  });
  const discoveryDone = new Set(searched.map((s) => s.entityId));

  let dismissed = 0;
  for (const o of researched) {
    if (!o.accountId) continue;
    const list = byAccount.get(o.accountId) ?? [];
    const anyEmail = list.some((c) => c.email);
    const anyPending = list.some((c) => !c.email && !c.emailLookupAt);
    if (anyEmail || anyPending || !discoveryDone.has(o.accountId)) continue;
    await db
      .update(opportunities)
      .set({ stage: "dismissed", updatedAt: new Date() })
      .where(eq(opportunities.id, o.id));
    await logActivity(db, {
      entityType: "opportunity",
      entityId: o.id,
      action: "opportunity.auto_dismissed",
      detail: `${o.name} — no reachable contact: ${list.length ? `${list.length} people tried, Apollo + Hunter empty` : "research and Apollo discovery found nobody"}. Resurfaces on a new signal after 90 days.`,
      actor: "system",
    });
    dismissed++;
  }
  return dismissed;
}
