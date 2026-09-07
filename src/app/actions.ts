"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval, retryRun } from "@/lib/ploybooks/runner";
import { createAccount } from "@/lib/actions/entities";

export async function launchPloybookAction(formData: FormData) {
  const key = String(formData.get("ploybookKey") ?? "");
  const db = await getDb();
  const runId = await launchRun(db, {
    ploybookKey: key,
    triggerType: "manual",
    initiatedBy: "user",
  });
  await executeRun(db, runId);
  revalidatePath("/ploybooks");
  revalidatePath("/approvals");
  revalidatePath("/");
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
