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
  const db = await getDb();
  await resolveApproval(db, approvalId, decision, { resolvedBy: "user" });
  revalidatePath("/approvals");
  revalidatePath("/ploybooks");
  revalidatePath("/");
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
  const { opportunities, accounts, projects } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const opp = await db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });
  if (!opp?.accountId) return;
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, opp.accountId) });
  const project = opp.projectId
    ? await db.query.projects.findFirst({ where: eq(projects.id, opp.projectId) })
    : null;
  if (!account) return;
  const runId = await launchRun(db, {
    ploybookKey: "pb01_gc_pursuit",
    triggerType: "manual",
    triggerPayload: {
      gcName: account.name,
      website: account.website ?? undefined,
      projectName: project?.name,
      city: project?.city ?? undefined,
      tradeScope: opp.tradeScope ?? undefined,
      opportunityId: opp.id,
    },
    primaryEntityType: "opportunity",
    primaryEntityId: opp.id,
    initiatedBy: "user",
  });
  executeInBackground(db, runId);
  revalidatePath("/opportunities");
  revalidatePath("/ploybooks");
  revalidatePath("/approvals");
  revalidatePath("/");
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
