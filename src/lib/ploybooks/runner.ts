import type { Db } from "@/lib/db/client";
import { ploybookRuns, ploybookSteps, approvals } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { emitEvent, logActivity } from "@/lib/events";
import { ensurePloybookRow, getPloybook } from "./registry";
import type { StepContext, StepResult } from "./types";

// Database-backed Ploybook runner (master PRD §8, §23):
// - explicit state machine, resumable, idempotent re-execution
// - pauses at approvals (§16) and resumes when resolved
// - every transition logs activity (§21) and emits events (§20)

export async function launchRun(
  db: Db,
  params: {
    ploybookKey: string;
    triggerType?: string;
    triggerPayload?: Record<string, unknown>;
    primaryEntityType?: string;
    primaryEntityId?: string;
    initiatedBy?: string;
    parentRunId?: string;
  }
): Promise<string> {
  const def = getPloybook(params.ploybookKey);
  const ploybookId = await ensurePloybookRow(db, def.key);

  const [run] = await db
    .insert(ploybookRuns)
    .values({
      ploybookId,
      ploybookKey: def.key,
      triggerType: params.triggerType ?? "manual",
      triggerPayload: params.triggerPayload ?? {},
      primaryEntityType: params.primaryEntityType,
      primaryEntityId: params.primaryEntityId,
      initiatedBy: params.initiatedBy ?? "system",
      parentRunId: params.parentRunId,
      status: "queued",
    })
    .returning();

  await db.insert(ploybookSteps).values(
    def.steps.map((step, i) => ({
      runId: run.id,
      stepKey: step.key,
      stepOrder: i,
      status: "pending",
    }))
  );

  await logActivity(db, {
    entityType: "ploybook_run",
    entityId: run.id,
    action: "run.launched",
    detail: `${def.name} launched (trigger: ${params.triggerType ?? "manual"})`,
    actor: params.initiatedBy ?? "system",
    ploybookRunId: run.id,
  });
  await emitEvent(db, {
    eventType: "ploybook.run_launched",
    ploybookRunId: run.id,
    payload: { ploybookKey: def.key },
  });

  return run.id;
}

async function setRunStatus(
  db: Db,
  runId: string,
  status: string,
  extra: Partial<typeof ploybookRuns.$inferInsert> = {}
) {
  await db
    .update(ploybookRuns)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(ploybookRuns.id, runId));
}

/**
 * Execute a run until it completes, fails, or pauses for approval.
 * Idempotent: completed/skipped steps are never re-executed; re-invoking on a
 * waiting run whose approval is still pending is a no-op.
 */
export async function executeRun(db: Db, runId: string): Promise<string> {
  const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
  if (!run) throw new Error(`Run not found: ${runId}`);
  if (["completed", "cancelled"].includes(run.status)) return run.status;

  const def = getPloybook(run.ploybookKey);
  await setRunStatus(db, runId, "running", { startedAt: run.startedAt ?? new Date(), error: null });

  const stepRows = await db.query.ploybookSteps.findMany({
    where: eq(ploybookSteps.runId, runId),
    orderBy: asc(ploybookSteps.stepOrder),
  });

  const priorOutputs: Record<string, Record<string, unknown>> = {};
  for (const row of stepRows) {
    if (row.status === "completed") {
      priorOutputs[row.stepKey] = (row.outputs ?? {}) as Record<string, unknown>;
    }
  }

  for (const row of stepRows) {
    if (row.status === "completed" || row.status === "skipped") continue;

    const stepDef = def.steps.find((s) => s.key === row.stepKey);
    if (!stepDef) throw new Error(`Step definition missing: ${run.ploybookKey}/${row.stepKey}`);

    // Resuming a step that was waiting: only proceed once its approval is resolved.
    let approvalResolution: StepContext["approvalResolution"];
    if (row.status === "waiting_for_approval") {
      const approval = await db.query.approvals.findFirst({
        where: and(eq(approvals.stepId, row.id)),
      });
      if (!approval || approval.status === "pending") {
        await setRunStatus(db, runId, "waiting_for_approval", { currentStep: row.stepKey });
        return "waiting_for_approval";
      }
      approvalResolution = {
        status: approval.status as "approved" | "rejected" | "edited",
        payload: (approval.resolutionPayload ?? null) as Record<string, unknown> | null,
        resolvedBy: approval.resolvedBy,
      };
    }

    await db
      .update(ploybookSteps)
      .set({
        status: "running",
        startedAt: row.startedAt ?? new Date(),
        attempts: row.attempts + 1,
        error: null,
      })
      .where(eq(ploybookSteps.id, row.id));
    await setRunStatus(db, runId, "running", { currentStep: row.stepKey });

    const ctx: StepContext = {
      db,
      runId,
      ploybookKey: run.ploybookKey,
      triggerPayload: (run.triggerPayload ?? {}) as Record<string, unknown>,
      primaryEntityType: run.primaryEntityType ?? undefined,
      primaryEntityId: run.primaryEntityId ?? undefined,
      priorOutputs,
      approvalResolution,
    };

    let result: StepResult;
    try {
      result = await stepDef.run(ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(ploybookSteps)
        .set({ status: "failed", error: message })
        .where(eq(ploybookSteps.id, row.id));
      await setRunStatus(db, runId, "failed", { error: `${row.stepKey}: ${message}` });
      await logActivity(db, {
        entityType: "ploybook_run",
        entityId: runId,
        action: "step.failed",
        detail: `${stepDef.name} failed: ${message}`,
        ploybookRunId: runId,
      });
      await emitEvent(db, {
        eventType: "ploybook.step_failed",
        ploybookRunId: runId,
        payload: { stepKey: row.stepKey, error: message },
      });
      return "failed";
    }

    if (result.kind === "needs_approval") {
      await db
        .update(ploybookSteps)
        .set({ status: "waiting_for_approval" })
        .where(eq(ploybookSteps.id, row.id));
      const [approval] = await db
        .insert(approvals)
        .values({
          runId,
          stepId: row.id,
          approvalType: result.approval.approvalType,
          title: result.approval.title,
          summary: result.approval.summary,
          proposedAction: result.approval.proposedAction,
          payload: result.approval.payload ?? {},
        })
        .returning();
      await setRunStatus(db, runId, "waiting_for_approval", { currentStep: row.stepKey });
      await logActivity(db, {
        entityType: "ploybook_run",
        entityId: runId,
        action: "approval.requested",
        detail: result.approval.title,
        ploybookRunId: runId,
      });
      await emitEvent(db, {
        eventType: "approval.requested",
        ploybookRunId: runId,
        payload: { approvalId: approval.id, approvalType: result.approval.approvalType },
      });
      return "waiting_for_approval";
    }

    if (result.kind === "skipped") {
      await db
        .update(ploybookSteps)
        .set({ status: "skipped", completedAt: new Date(), outputs: { reason: result.reason } })
        .where(eq(ploybookSteps.id, row.id));
      await logActivity(db, {
        entityType: "ploybook_run",
        entityId: runId,
        action: "step.skipped",
        detail: `${stepDef.name}: ${result.reason}`,
        ploybookRunId: runId,
      });
      continue;
    }

    const outputs = result.outputs ?? {};
    priorOutputs[row.stepKey] = outputs;
    await db
      .update(ploybookSteps)
      .set({ status: "completed", completedAt: new Date(), outputs })
      .where(eq(ploybookSteps.id, row.id));
    await logActivity(db, {
      entityType: "ploybook_run",
      entityId: runId,
      action: "step.completed",
      detail: stepDef.name,
      ploybookRunId: runId,
    });
  }

  await setRunStatus(db, runId, "completed", { completedAt: new Date(), currentStep: null });
  await logActivity(db, {
    entityType: "ploybook_run",
    entityId: runId,
    action: "run.completed",
    detail: `${def.name} completed`,
    ploybookRunId: runId,
  });
  await emitEvent(db, {
    eventType: "ploybook.run_completed",
    ploybookRunId: runId,
    payload: { ploybookKey: def.key },
  });
  return "completed";
}

/** Resolve a pending approval and resume its run. */
export async function resolveApproval(
  db: Db,
  approvalId: string,
  decision: "approved" | "rejected" | "edited",
  options: { resolvedBy?: string; resolutionPayload?: Record<string, unknown> } = {}
): Promise<string> {
  const approval = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
  if (!approval) throw new Error(`Approval not found: ${approvalId}`);
  if (approval.status !== "pending") throw new Error(`Approval already ${approval.status}`);

  await db
    .update(approvals)
    .set({
      status: decision,
      resolvedAt: new Date(),
      resolvedBy: options.resolvedBy ?? "user",
      resolutionPayload: options.resolutionPayload ?? null,
    })
    .where(eq(approvals.id, approvalId));

  if (approval.runId) {
    await logActivity(db, {
      entityType: "ploybook_run",
      entityId: approval.runId,
      action: `approval.${decision}`,
      detail: approval.title,
      actor: options.resolvedBy ?? "user",
      ploybookRunId: approval.runId,
    });
    await emitEvent(db, {
      eventType: `approval.${decision}`,
      actor: "user",
      ploybookRunId: approval.runId,
      payload: { approvalId },
    });
    return executeRun(db, approval.runId);
  }
  return decision;
}

/** Reset a failed run's failed step to pending and re-execute (visible retry, §23). */
export async function retryRun(db: Db, runId: string): Promise<string> {
  await db
    .update(ploybookSteps)
    .set({ status: "pending", error: null })
    .where(and(eq(ploybookSteps.runId, runId), eq(ploybookSteps.status, "failed")));
  await logActivity(db, {
    entityType: "ploybook_run",
    entityId: runId,
    action: "run.retried",
    ploybookRunId: runId,
  });
  return executeRun(db, runId);
}
