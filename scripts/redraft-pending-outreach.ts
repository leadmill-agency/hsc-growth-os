// One-off (2026-09-10): pending send_outreach approvals were drafted before
// the owner's-voice rewrite ("registered with TDLR" etc.). Re-draft each one
// with the current draftOutreach prompt, using the run's own research brief and
// stakeholder map, and update the approval payload in place — preserving any
// Hunter-found suggested_email fields. Idempotent per approval.
//   npx tsx scripts/redraft-pending-outreach.ts
import { readFileSync } from "node:fs";

async function main() {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
  const { getDb } = await import("../src/lib/db/client");
  const { draftOutreach } = await import("../src/lib/actions/outreach");
  const { approvals, ploybookSteps } = await import("../src/lib/db/schema");
  const { and, eq, inArray, sql } = await import("drizzle-orm");
  const db = await getDb();

  const pending = await db.query.approvals.findMany({
    where: and(eq(approvals.status, "pending"), eq(approvals.approvalType, "send_outreach")),
  });
  console.log(`${pending.length} pending outreach drafts to rewrite`);

  for (const approval of pending) {
    if (!approval.runId) continue;
    const steps = await db.query.ploybookSteps.findMany({
      where: and(
        eq(ploybookSteps.runId, approval.runId),
        inArray(ploybookSteps.stepKey, ["normalize_entities", "research", "stakeholder_map"])
      ),
    });
    const byKey = new Map(steps.map((s) => [s.stepKey, s.outputs as Record<string, unknown>]));
    const prior = byKey.get("normalize_entities");
    const brief = byKey.get("research")?.brief;
    const stakeholders = byKey.get("stakeholder_map")?.stakeholders;
    if (!prior || !brief || !stakeholders) {
      console.log(` skip (missing step data): ${approval.title}`);
      continue;
    }
    try {
      const draft = await draftOutreach({
        accountName: prior.accountName as string,
        projectName: prior.projectName as string | undefined,
        brief: brief as never,
        stakeholders: stakeholders as never,
      });
      const old = ((approval.payload ?? {}) as { draft?: Record<string, unknown> }).draft ?? {};
      // Keep the Hunter enrichment ONLY if it still matches the draft's target
      // (a re-draft can change target_contact; a mismatched pre-filled email
      // would send to the wrong person).
      const target = String((draft as { target_contact?: string }).target_contact ?? "").toLowerCase();
      const oldEmail = String(old.suggested_email ?? "").toLowerCase();
      const nameTokens = target.split(/[^a-z]+/).filter((t) => t.length > 2);
      const emailMatchesTarget =
        !!oldEmail && nameTokens.some((t) => oldEmail.split("@")[0].includes(t));
      const merged = {
        ...draft,
        ...(emailMatchesTarget
          ? {
              suggested_email: old.suggested_email,
              suggested_email_confidence: old.suggested_email_confidence,
              suggested_email_source: old.suggested_email_source,
            }
          : {}),
      };
      await db
        .update(approvals)
        .set({ payload: sql`jsonb_set(${approvals.payload}, '{draft}', ${JSON.stringify(merged)}::jsonb)` })
        .where(eq(approvals.id, approval.id));
      console.log(` rewrote: ${approval.title}`);
    } catch (err) {
      console.log(` FAILED ${approval.title}: ${(err as Error).message.slice(0, 100)}`);
    }
  }
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
