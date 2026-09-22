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

  const pending = await db.query.contacts.findMany({
    where: and(
      inArray(contacts.accountId, accountIds),
      isNull(contacts.email),
      isNull(contacts.emailLookupAt)
    ),
    orderBy: (c, { desc: d }) => [d(c.influenceScore)],
    limit,
  });
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
      } catch {
        // finder is best-effort
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
