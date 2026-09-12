"use server";

import { revalidatePath } from "next/cache";
import { getDb, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval, retryRun } from "@/lib/ploybooks/runner";
import { createAccount } from "@/lib/actions/entities";

// Long-running ploybook steps (live research can take minutes) must not block the
// HTTP request — the request aborts when the user navigates and kills the run
// mid-step (master PRD §8). Execute in the background; the runner is resumable,
// so a run interrupted by a dev restart is continued with Resume.
function executeInBackground(db: Db, runId: string) {
  void executeRun(db, runId).catch((err) => {
    console.error(`[ploybook] background run ${runId} failed:`, err);
  });
}

// Each ploybook's primary manual input maps onto its trigger payload.
const inputFieldByPloybook: Record<string, string> = {
  pb01_gc_pursuit: "gcName",
  pb02_commercial_development: "developmentName",
  pb03_franchise_expansion: "brandName",
  pb04_facility_portfolio: "operatorName",
  pb05_opportunity_radar: "signalText",
  pb06_company_swarm: "accountName",
  pb07_abm_page: "accountName",
  pb08_high_intent_visitor: "companyName",
  pb09_account_research: "accountName",
  pb10_incoming_bid: "inviteText",
  pb11_bid_analyzer: "folderPath",
  pb12_bid_qa: "bidId",
  pb13_bid_followup: "bidId",
  pb14_deal_room: "opportunityId",
  pb15_business_case: "opportunityId",
  pb16_local_seo: "matrixInput",
  pb17_content_builder: "topicInput",
};

export async function launchPloybookAction(formData: FormData) {
  const key = String(formData.get("ploybookKey") ?? "");
  const input = String(formData.get("input") ?? "").trim();
  const field = inputFieldByPloybook[key];
  if (field && !input) return; // this ploybook needs its input to run
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: key,
    triggerType: "manual",
    triggerPayload: field && input ? { [field]: input } : {},
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/ploybooks");
  revalidatePath("/approvals");
  revalidatePath("/bids");
  revalidatePath("/");
}

export async function resumeRunAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const db = await getDb();
  executeInBackground(db, runId);
  revalidatePath("/ploybooks");
}

export async function resolveApprovalAction(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  const decision = String(formData.get("decision") ?? "") as "approved" | "rejected";
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  // Rejection code + note (per Rameel 2026-09-10): captured so passes are
  // explainable later — they land in resolutionPayload and, for bids, on the card.
  const rejectionCode = String(formData.get("rejectionCode") ?? "").trim();
  const rejectionNote = String(formData.get("rejectionNote") ?? "").trim();
  const db = await getDb();
  await resolveApproval(db, approvalId, decision, {
    resolvedBy: "user",
    resolutionPayload:
      decision === "rejected" && (rejectionCode || rejectionNote)
        ? { rejectionCode: rejectionCode || null, rejectionNote: rejectionNote || null }
        : undefined,
  });

  // Approving a swarm sequence fans it out: each message becomes its own
  // editable send_outreach card with a Hunter-found address — the same review/
  // edit/send flow as Write email, one card per person (per Rameel 2026-09-11).
  if (decision === "approved") {
    try {
      const { approvals, ploybookSteps, accounts } = await import("@/lib/db/schema");
      const { and, eq } = await import("drizzle-orm");
      const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
      if (approval?.approvalType === "swarm_outreach") {
        const payload = (approval.payload ?? {}) as {
          plan?: { sequencing_rationale?: string };
          messages?: { contact_name: string; subject: string; body: string; day_offset: number }[];
        };
        let accountId: string | undefined;
        let accountName = "";
        let domain: string | undefined;
        if (approval.runId) {
          const step = await db.query.ploybookSteps.findFirst({
            where: and(
              eq(ploybookSteps.runId, approval.runId),
              eq(ploybookSteps.stepKey, "resolve_account")
            ),
          });
          const out = (step?.outputs ?? {}) as { accountId?: string; accountName?: string };
          accountId = out.accountId;
          accountName = out.accountName ?? "";
          if (accountId) {
            const acc = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
            accountName = accountName || acc?.name || "";
            domain =
              acc?.domain ??
              acc?.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
          }
        }
        const { createApproval } = await import("@/lib/ploybooks/runner");
        for (const m of payload.messages ?? []) {
          let draft: Record<string, unknown> = {
            subject: m.subject,
            body: m.body,
            target_contact: m.contact_name,
            day_offset: m.day_offset,
          };
          try {
            const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");
            const found = await findWorkEmail({
              fullName: m.contact_name,
              domain,
              company: accountName || undefined,
            });
            draft = found
              ? {
                  ...draft,
                  suggested_email: found.email,
                  suggested_email_confidence: found.confidence,
                  suggested_email_source: found.source,
                }
              : {
                  ...draft,
                  suggested_email_note: domain
                    ? `Hunter has no email for ${m.contact_name} at ${domain} — try LinkedIn.`
                    : `No website on file for ${accountName || "this company"} — add it on the account and use Find email.`,
                };
          } catch {
            // enrichment is best-effort
          }
          await createApproval(db, {
            approvalType: "send_outreach",
            title: `Send outreach: ${accountName || "swarm"} — ${m.contact_name} (Day ${m.day_offset})`,
            summary: payload.plan?.sequencing_rationale,
            proposedAction:
              "Part of the approved swarm sequence. Edit freely; approving with a verified email sends it as Ray on this message's day.",
            payload: { draft, accountId },
          });
        }
        revalidatePath("/researched");
      }
    } catch (err) {
      console.error(`[swarm] fan-out failed for approval ${approvalId}:`, err);
    }
  }

  // Approve + recipient on an outreach/follow-up = actually send (guarded layer
  // still refuses unless ALLOW_EXTERNAL_SEND=true and the domain is live).
  if (decision === "approved" && recipientEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipientEmail)) {
    try {
      const { approvals, followups } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
      const payload = (approval?.payload ?? {}) as {
        draft?: { subject?: string; body?: string; alternate_subject?: string; alternate_body?: string };
        followupId?: string;
        opportunityId?: string;
      };
      // The card offers Version A/B with editable fields — the selected
      // version, WITH the user's edits, is exactly what sends.
      const useAlternate =
        String(formData.get("draftVersion") ?? "primary") === "alternate" &&
        !!payload.draft?.alternate_body;
      const editedSubject = String(
        formData.get(useAlternate ? "subject_alternate" : "subject_primary") ?? ""
      ).trim();
      const editedBody = String(
        formData.get(useAlternate ? "body_alternate" : "body_primary") ?? ""
      ).trim();
      const subject =
        editedSubject ||
        (useAlternate ? (payload.draft?.alternate_subject ?? payload.draft?.subject) : payload.draft?.subject);
      const body =
        editedBody || (useAlternate ? payload.draft?.alternate_body : payload.draft?.body);
      if (
        approval &&
        ["send_outreach", "send_followup"].includes(approval.approvalType) &&
        subject &&
        body
      ) {
        const { sendExternal } = await import("@/lib/outbound/send");
        await sendExternal(db, approvalId, {
          channel: "email",
          to: recipientEmail,
          subject,
          body,
          opportunityId: payload.opportunityId,
        });
        if (payload.followupId) {
          await db
            .update(followups)
            .set({ status: "sent", updatedAt: new Date() })
            .where(eq(followups.id, payload.followupId));
        }
      }
    } catch (err) {
      // Sending blocked (env off / domain unverified / no adapter) — approval still stands.
      console.warn(`[send] approval ${approvalId} approved but send skipped:`, (err as Error).message);
    }
  }
  revalidatePath("/approvals");
  revalidatePath("/ploybooks");
  revalidatePath("/");
}

// On-demand Hunter lookup from an approval card (per Rameel 2026-09-10):
// finds the draft's target contact email and stores it on the card.
export async function findEmailForApprovalAction(formData: FormData) {
  const approvalId = String(formData.get("approvalId") ?? "");
  if (!approvalId) return;
  const db = await getDb();
  const { approvals, opportunities, accounts } = await import("@/lib/db/schema");
  const { eq, sql } = await import("drizzle-orm");
  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
  const payload = (approval?.payload ?? {}) as {
    draft?: { target_contact?: string };
    opportunityId?: string;
  };
  const target = payload.draft?.target_contact;
  if (!approval || !target) return;
  const opp = payload.opportunityId
    ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, payload.opportunityId) })
    : null;
  const account = opp?.accountId
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, opp.accountId) })
    : null;
  const domain =
    account?.domain ??
    account?.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const fullName = target.split(",")[0]?.trim();
  const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");
  const found = fullName
    ? await findWorkEmail({ fullName, domain: domain ?? undefined, company: account?.name })
    : null;
  // Say WHY when nothing comes back — a silent no-op reads as a dead button.
  const failureNote = !fullName
    ? "No contact name on this draft to look up"
    : !domain
      ? `No website on file for ${account?.name ?? "this company"} — Hunter needs a domain. Find their site, add it on the account, and try again (or check LinkedIn).`
      : `Hunter has no email for ${fullName} at ${domain} — try LinkedIn or the company site.`;
  const patch = found
    ? {
        suggested_email: found.email,
        suggested_email_confidence: found.confidence,
        suggested_email_source: found.source,
        suggested_email_note: null,
      }
    : { suggested_email_note: failureNote };
  await db
    .update(approvals)
    .set({
      payload: sql`jsonb_set(${approvals.payload}, '{draft}', (${approvals.payload}->'draft') || ${JSON.stringify(patch)}::jsonb)`,
    })
    .where(eq(approvals.id, approvalId));
  revalidatePath("/approvals");
}

export async function retryRunAction(formData: FormData) {
  const runId = String(formData.get("runId") ?? "");
  const db = await getDb();
  await retryRun(db, runId);
  revalidatePath("/ploybooks");
}

export async function submitSignalAction(formData: FormData) {
  const signalText = String(formData.get("signalText") ?? "").trim();
  if (!signalText) return;
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: "pb05_opportunity_radar",
    triggerType: "manual",
    triggerPayload: {
      signalText,
      sourceUrl: String(formData.get("sourceUrl") ?? "") || undefined,
      source: "manual_signal",
    },
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/opportunities");
  revalidatePath("/");
}

export async function pursueOpportunityAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const db = await getDb();
  const { opportunities, bids } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, opportunityId) });

  // Incoming-bid cards: Pursue = "we're bidding this" — straight to the bid
  // desk (Researched → Bids Interested In), no research run needed.
  if (opp && ["incoming_bid", "bid"].includes(opp.opportunityType ?? "")) {
    await db
      .update(opportunities)
      .set({ stage: "bidding", nextAction: null, updatedAt: new Date() })
      .where(eq(opportunities.id, opportunityId));
    const bid = await db.query.bids.findFirst({ where: eq(bids.opportunityId, opportunityId) });
    if (bid && bid.status === "invited") {
      await db
        .update(bids)
        .set({ status: "estimating", updatedAt: new Date() })
        .where(eq(bids.id, bid.id));
    }
    const { logActivity } = await import("@/lib/events");
    await logActivity(db, {
      entityType: "opportunity",
      entityId: opportunityId,
      action: "bid.interested",
      detail: `${opp.name} — moved to the bid desk`,
      actor: "user",
    });
    revalidatePath("/opportunities");
    revalidatePath("/researched");
    revalidatePath("/");
    return;
  }

  // Research already on file (e.g. cards returned to the inbox after the
  // 2026-09-11 reset): Pursue moves them to Researched instantly — no rerun,
  // no cost. The account's Research button forces a fresh run when needed.
  if (opp?.accountId) {
    const { evidence } = await import("@/lib/db/schema");
    const { and } = await import("drizzle-orm");
    const existingBrief = await db.query.evidence.findFirst({
      where: and(
        eq(evidence.entityType, "account"),
        eq(evidence.entityId, opp.accountId),
        eq(evidence.fieldName, "research_brief")
      ),
    });
    if (existingBrief) {
      await db
        .update(opportunities)
        .set({ stage: "researched", nextAction: "Research on file — see the brief", updatedAt: new Date() })
        .where(eq(opportunities.id, opportunityId));
      const { logActivity } = await import("@/lib/events");
      await logActivity(db, {
        entityType: "opportunity",
        entityId: opportunityId,
        action: "opportunity.researched",
        detail: `${opp.name} — existing research reused, moved to Researched`,
        actor: "user",
      });
      revalidatePath("/opportunities");
      revalidatePath("/researched");
      revalidatePath("/");
      return;
    }
  }

  const { launchPursuit } = await import("@/lib/actions/pursue");
  const result = await launchPursuit(db, opportunityId, {
    triggerType: "manual",
    initiatedBy: "user",
  });
  if (result.runId) executeInBackground(db, result.runId);
  revalidatePath("/opportunities");
  revalidatePath("/ploybooks");
  revalidatePath("/researched");
  revalidatePath("/");
}

// "Write email" on a researched card (per Rameel 2026-09-10): find the email
// (Hunter), draft in the owner's voice from the run's own research, and put an
// editable draft on the card. Sending stays a separate explicit step.
export async function writeEmailAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  if (!opportunityId) return;
  const db = await getDb();
  const { ploybookRuns, ploybookSteps, accounts, opportunities } = await import("@/lib/db/schema");
  const { and, eq, desc, inArray, sql } = await import("drizzle-orm");
  const run = await db.query.ploybookRuns.findFirst({
    where: and(
      eq(ploybookRuns.ploybookKey, "pb01_gc_pursuit"),
      sql`${ploybookRuns.triggerPayload}->>'opportunityId' = ${opportunityId}`
    ),
    orderBy: desc(ploybookRuns.createdAt),
  });
  const opp = await db.query.opportunities.findFirst({ where: eq(opportunities.id, opportunityId) });
  const account = opp?.accountId
    ? await db.query.accounts.findFirst({ where: eq(accounts.id, opp.accountId) })
    : null;
  if (!run || !opp || !account) return;
  const steps = await db.query.ploybookSteps.findMany({
    where: and(
      eq(ploybookSteps.runId, run.id),
      inArray(ploybookSteps.stepKey, ["research", "stakeholder_map", "score_fit"])
    ),
  });
  const byKey = new Map(steps.map((s) => [s.stepKey, s.outputs as Record<string, unknown>]));
  const brief = byKey.get("research")?.brief;
  const stakeholders = byKey.get("stakeholder_map")?.stakeholders as
    | { people: { name?: string; title?: string }[] }
    | undefined;
  if (!brief || !stakeholders) return;

  const { draftOutreach } = await import("@/lib/actions/outreach");
  const draft = (await draftOutreach({
    accountName: account.name,
    projectName: opp.name,
    brief: brief as never,
    stakeholders: stakeholders as never,
  })) as Record<string, unknown> & { target_contact?: string };

  // Hunter enrichment — pre-fill the send field when we can.
  let enriched: Record<string, unknown> = draft;
  try {
    const { findWorkEmail } = await import("@/lib/integrations/email-finder/client");
    const domain =
      account.domain ??
      account.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const fullName = draft.target_contact?.split(",")[0]?.trim();
    const found = fullName
      ? await findWorkEmail({ fullName, domain: domain ?? undefined, company: account.name })
      : null;
    enriched = found
      ? {
          ...draft,
          suggested_email: found.email,
          suggested_email_confidence: found.confidence,
          suggested_email_source: found.source,
        }
      : {
          ...draft,
          suggested_email_note: domain
            ? `Hunter has no email for ${fullName ?? "this contact"} at ${domain} — try LinkedIn.`
            : `No website on file for ${account.name} — add it on the account page and retry.`,
        };
  } catch {
    // enrichment is best-effort
  }

  const { createApproval } = await import("@/lib/ploybooks/runner");
  await createApproval(db, {
    approvalType: "send_outreach",
    title: `Send outreach: ${account.name}`,
    summary: `Drafted on request from the Researched tab for ${opp.name}.`,
    proposedAction: "Review/edit the draft; approving with an email sends it as Ray.",
    payload: { draft: enriched, opportunityId },
  });
  revalidatePath("/researched");
}

// Manual stage control on opportunity cards (per Rameel 2026-09-10: "we
// actually already won the flying biscuit cafe"). Won/lost/dismissed are
// terminal; the card reflects reality even when the deal closed offline.
export async function setOpportunityStageAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!opportunityId || !["won", "lost", "dismissed"].includes(stage)) return;
  // Dismissals REQUIRE a reason (per Rameel 2026-09-12): each one teaches the
  // radar what a bad opportunity looks like. Enforced in the UI (required
  // select) and here — no reason, no dismissal.
  const dismissReason = String(formData.get("dismissReason") ?? "").trim();
  const dismissNote = String(formData.get("dismissNote") ?? "").trim();
  if (stage === "dismissed" && !dismissReason) return;
  const db = await getDb();
  const { opportunities } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [updated] = await db
    .update(opportunities)
    .set({ stage, nextAction: null, updatedAt: new Date() })
    .where(eq(opportunities.id, opportunityId))
    .returning();
  // A dismissed/lost bid card also passes its bid on the bid desk.
  if (updated && ["dismissed", "lost"].includes(stage)) {
    const { bids } = await import("@/lib/db/schema");
    const bid = await db.query.bids.findFirst({ where: eq(bids.opportunityId, opportunityId) });
    if (bid && !["won", "lost", "passed"].includes(bid.status)) {
      await db
        .update(bids)
        .set({ status: "passed", updatedAt: new Date() })
        .where(eq(bids.id, bid.id));
    }
  }
  if (updated) {
    const { logActivity, emitEvent } = await import("@/lib/events");
    await logActivity(db, {
      entityType: "opportunity",
      entityId: opportunityId,
      action: `opportunity.${stage}`,
      detail:
        stage === "dismissed"
          ? `${updated.name} dismissed: ${dismissReason.replaceAll("_", " ")}${dismissNote ? ` — ${dismissNote}` : ""}`
          : `${updated.name} marked ${stage} from the inbox`,
      actor: "user",
      metadata:
        stage === "dismissed"
          ? { reasonCode: dismissReason, note: dismissNote || undefined, source: updated.source ?? undefined, score: updated.overallScore ?? updated.fitScore ?? undefined }
          : undefined,
    });
    await emitEvent(db, {
      eventType: `opportunity.${stage}`,
      opportunityId,
      accountId: updated.accountId ?? undefined,
      actor: "user",
      payload: {},
    });
  }
  revalidatePath("/opportunities");
  revalidatePath("/");
}

export async function runBidQaAction(formData: FormData) {
  const bidId = String(formData.get("bidId") ?? "");
  if (!bidId) return;
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: "pb12_bid_qa",
    triggerType: "manual",
    triggerPayload: { bidId },
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/bids");
  revalidatePath("/approvals");
}

export async function uploadBidPackageAction(formData: FormData) {
  const bidId = String(formData.get("bidId") ?? "");
  const file = formData.get("package");
  if (!bidId || !(file instanceof File)) return;
  if (!file.name.toLowerCase().endsWith(".zip")) return;
  const { MAX_UPLOAD_BYTES, extractZipToDir, storageRoot } = await import(
    "@/lib/documents/upload"
  );
  if (file.size > MAX_UPLOAD_BYTES) return;
  const buffer = Buffer.from(await file.arrayBuffer());
  const destDir = `${storageRoot()}/uploads/${bidId}`;
  const extracted = await extractZipToDir(buffer, destDir);
  if (extracted === 0) return;
  // Hand straight to the analyzer with the bid's context
  const analyzeForm = new FormData();
  analyzeForm.set("bidId", bidId);
  analyzeForm.set("folderPath", destDir);
  await analyzeBidAction(analyzeForm);
}

export async function analyzeBidAction(formData: FormData) {
  const bidId = String(formData.get("bidId") ?? "");
  const folderPath = String(formData.get("folderPath") ?? "").trim();
  if (!bidId || !folderPath) return;
  const db = await getDb();
  const { bids, opportunities, projects } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const bid = await db.query.bids.findFirst({ where: eq(bids.id, bidId) });
  const opp = bid?.opportunityId
    ? await db.query.opportunities.findFirst({ where: eq(opportunities.id, bid.opportunityId) })
    : null;
  const project = opp?.projectId
    ? await db.query.projects.findFirst({ where: eq(projects.id, opp.projectId) })
    : null;
  const runId = await launchRun(db, {
    ploybookKey: "pb11_bid_analyzer",
    triggerType: "manual",
    triggerPayload: {
      folderPath,
      bidId,
      opportunityId: bid?.opportunityId ?? undefined,
      projectId: opp?.projectId ?? undefined,
      projectName: project?.name ?? opp?.name,
      bidDueAt: bid?.dueAt?.toISOString(),
    },
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/bids");
  revalidatePath("/ploybooks");
}

// Record what happened to a bid. "Submitted" is the moment that matters: it
// fires bid.submitted, which auto-creates the Day-2/7/14/30 follow-up cadence
// (previously only the PB12 QA gate could do this — bids submitted straight in
// PlanHub never started their follow-ups). Won/Lost close the loop and cancel
// any follow-ups still pending.
export async function recordBidOutcomeAction(formData: FormData) {
  const bidId = String(formData.get("bidId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  if (!bidId || !["submitted", "won", "lost"].includes(outcome)) return;
  const db = await getDb();
  const { bids, opportunities, followups } = await import("@/lib/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { emitEvent, logActivity } = await import("@/lib/events");
  const bid = await db.query.bids.findFirst({ where: eq(bids.id, bidId) });
  if (!bid) return;

  if (outcome === "submitted") {
    if (bid.status === "submitted") return; // don't double-fire the follow-up cadence
    const [updated] = await db
      .update(bids)
      .set({ submittedAt: new Date(), status: "submitted", updatedAt: new Date() })
      .where(eq(bids.id, bidId))
      .returning();
    await logActivity(db, {
      entityType: "bid",
      entityId: bidId,
      action: "bid.submitted",
      detail: "Marked submitted from the bid desk",
      actor: "user",
    });
    await emitEvent(db, {
      eventType: "bid.submitted", // PB13 subscription creates the follow-up cadence
      bidId,
      opportunityId: updated.opportunityId ?? undefined,
      actor: "user",
      payload: { submittedAt: updated.submittedAt?.toISOString() },
    });
  } else {
    const won = outcome === "won";
    const awardAmount = String(formData.get("awardAmount") ?? "").replace(/[$,\s]/g, "");
    const lossReason = String(formData.get("lossReason") ?? "").trim();
    await db
      .update(bids)
      .set({
        status: outcome,
        awardAmount: won && awardAmount ? awardAmount : undefined,
        lossReason: !won && lossReason ? lossReason : undefined,
        updatedAt: new Date(),
      })
      .where(eq(bids.id, bidId));
    if (bid.opportunityId) {
      await db
        .update(opportunities)
        .set({ stage: won ? "won" : "lost", updatedAt: new Date() })
        .where(eq(opportunities.id, bid.opportunityId));
    }
    // Outcome known → any remaining follow-ups are moot.
    await db
      .update(followups)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(followups.bidId, bidId), inArray(followups.status, ["pending", "drafted"])));
    await logActivity(db, {
      entityType: "bid",
      entityId: bidId,
      action: won ? "bid.won" : "bid.lost",
      detail: won
        ? awardAmount
          ? `Won — $${Number(awardAmount).toLocaleString()}`
          : "Won"
        : lossReason
          ? `Lost — ${lossReason}`
          : "Lost",
      actor: "user",
    });
    await emitEvent(db, {
      eventType: won ? "bid.won" : "bid.lost",
      bidId,
      opportunityId: bid.opportunityId ?? undefined,
      actor: "user",
      payload: won ? { awardAmount: awardAmount || null } : { lossReason: lossReason || null },
    });
  }
  revalidatePath("/bids");
  revalidatePath("/");
}

// Standalone bid-desk entry (per Rameel: "when looking at bids, i dont see a place
// where i can upload zip files") — no pre-existing bid row required. Creates the
// minimal opportunity + bid, then runs the same upload→analyze path.
export async function startBidFromPackageAction(formData: FormData) {
  const projectName = String(formData.get("projectName") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const file = formData.get("package");
  if (!projectName || !(file instanceof File) || !file.name.toLowerCase().endsWith(".zip")) return;
  const db = await getDb();
  const { bids } = await import("@/lib/db/schema");
  const { createOpportunity } = await import("@/lib/actions/entities");
  const { opportunity } = await createOpportunity(db, {
    name: projectName,
    opportunityType: "bid",
    stage: "bidding",
    source: "bid_package",
    sourceDetail: "uploaded bid package",
    actor: "user",
  });
  const [bid] = await db
    .insert(bids)
    .values({
      opportunityId: opportunity.id,
      status: "estimating",
      dueAt: dueDate ? new Date(`${dueDate}T12:00:00Z`) : null,
      notes: `Created from uploaded package: ${file.name}`,
    })
    .returning();
  const uploadForm = new FormData();
  uploadForm.set("bidId", bid.id);
  uploadForm.set("package", file);
  await uploadBidPackageAction(uploadForm);
  revalidatePath("/bids");
}

export async function pullTdlrAction() {
  const db = await getDb();
  const { runTdlrPull } = await import("@/lib/integrations/tdlr/runner");
  void runTdlrPull(db).catch((err) => console.error("[tdlr] manual pull failed:", err));
  revalidatePath("/opportunities");
}

const accountPloybooks: Record<string, { key: string; field: string }> = {
  swarm: { key: "pb06_company_swarm", field: "accountName" },
  abm_page: { key: "pb07_abm_page", field: "accountName" },
  research: { key: "pb09_account_research", field: "accountName" },
};

export async function launchAccountPloybookAction(formData: FormData) {
  const accountName = String(formData.get("accountName") ?? "").trim();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const which = String(formData.get("which") ?? "");
  const config = accountPloybooks[which];
  if (!accountName || !config) return;
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: config.key,
    triggerType: "manual",
    triggerPayload: { [config.field]: accountName },
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/accounts");
  revalidatePath("/ploybooks");
  revalidatePath("/approvals");
  // Land the user somewhere that SHOWS the run started — a silent background
  // launch reads as a dead button (Rameel, 2026-09-10).
  if (accountId) {
    const { redirect } = await import("next/navigation");
    redirect(`/accounts/${accountId}?launched=${which}`);
  }
}

export async function createAccountAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const db = await getDb();
  await createAccount(db, {
    name,
    accountType: String(formData.get("accountType") ?? "prospect"),
    website: String(formData.get("website") ?? "") || undefined,
    actor: "user",
  });
  revalidatePath("/accounts");
  revalidatePath("/");
}
