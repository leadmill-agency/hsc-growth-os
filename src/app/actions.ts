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
  const patch = found
    ? {
        suggested_email: found.email,
        suggested_email_confidence: found.confidence,
        suggested_email_source: found.source,
      }
    : { suggested_email_note: "No email found — try LinkedIn or the company site" };
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
  const { launchPursuit } = await import("@/lib/actions/pursue");
  const result = await launchPursuit(db, opportunityId, {
    triggerType: "manual",
    initiatedBy: "user",
  });
  if (result.runId) executeInBackground(db, result.runId);
  revalidatePath("/opportunities");
  revalidatePath("/ploybooks");
  revalidatePath("/approvals");
  revalidatePath("/");
}

// Manual stage control on opportunity cards (per Rameel 2026-09-10: "we
// actually already won the flying biscuit cafe"). Won/lost/dismissed are
// terminal; the card reflects reality even when the deal closed offline.
export async function setOpportunityStageAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  if (!opportunityId || !["won", "lost", "dismissed"].includes(stage)) return;
  const db = await getDb();
  const { opportunities } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [updated] = await db
    .update(opportunities)
    .set({ stage, nextAction: null, updatedAt: new Date() })
    .where(eq(opportunities.id, opportunityId))
    .returning();
  if (updated) {
    const { logActivity, emitEvent } = await import("@/lib/events");
    await logActivity(db, {
      entityType: "opportunity",
      entityId: opportunityId,
      action: `opportunity.${stage}`,
      detail: `${updated.name} marked ${stage} from the inbox`,
      actor: "user",
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
