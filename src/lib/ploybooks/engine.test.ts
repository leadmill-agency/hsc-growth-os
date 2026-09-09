import { beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests, type Db } from "@/lib/db/client";
import "@/lib/ploybooks";
import { launchRun, executeRun, resolveApproval, retryRun } from "@/lib/ploybooks/runner";
import { registerPloybook } from "@/lib/ploybooks/registry";
import {
  ploybookRuns,
  ploybookSteps,
  approvals,
  activities,
  events,
  accounts,
  opportunities,
} from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { createAccount } from "@/lib/actions/entities";
import type { PloybookDefinition } from "@/lib/ploybooks/types";

// Phase 0 gate (master PRD §26 Phase 0 acceptance criteria):
// - can create account/project/opportunity
// - can launch dummy Ploybook; run shows steps
// - run pauses for approval; approval resumes run
// - all activity logged
// Plus §23 error handling: retry, idempotent re-execution.

let db: Db;

beforeEach(async () => {
  resetDbForTests();
  db = await getDb();
});

describe("shared entity actions", () => {
  it("creates and dedupes accounts by domain and slug", async () => {
    const first = await createAccount(db, {
      name: "Harvey Cleary",
      website: "https://www.harveycleary.com",
    });
    expect(first.created).toBe(true);
    const byDomain = await createAccount(db, {
      name: "Harvey-Cleary Builders",
      website: "harveycleary.com",
    });
    expect(byDomain.created).toBe(false);
    expect(byDomain.account.id).toBe(first.account.id);
    const bySlug = await createAccount(db, { name: "Harvey Cleary" });
    expect(bySlug.created).toBe(false);
    const all = await db.select().from(accounts);
    expect(all).toHaveLength(1);
  });
});

describe("ploybook engine", () => {
  it("runs the dummy ploybook end-to-end: pause on approval, resume, complete, log everything", async () => {
    const runId = await launchRun(db, {
      ploybookKey: "pb00_dummy",
      triggerType: "manual",
      triggerPayload: { accountName: "Test GC", projectName: "Test Project" },
      initiatedBy: "rameel",
    });

    // Run shows steps
    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect(steps.map((s) => s.stepKey)).toEqual([
      "create_entities",
      "record_evidence",
      "request_approval",
      "finalize",
    ]);

    // Executes until the approval gate
    const status = await executeRun(db, runId);
    expect(status).toBe("waiting_for_approval");

    const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
    expect(run?.status).toBe("waiting_for_approval");
    expect(run?.currentStep).toBe("request_approval");

    // Entities were created via shared actions
    const opps = await db.select().from(opportunities);
    expect(opps).toHaveLength(1);

    // Re-executing while waiting is a no-op (idempotent)
    expect(await executeRun(db, runId)).toBe("waiting_for_approval");

    // A pending approval exists
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    expect(pending?.status).toBe("pending");

    // Approving resumes and completes the run
    const finalStatus = await resolveApproval(db, pending!.id, "approved", {
      resolvedBy: "rameel",
    });
    expect(finalStatus).toBe("completed");

    const doneSteps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect(doneSteps.every((s) => s.status === "completed")).toBe(true);
    expect((doneSteps[2].outputs as Record<string, unknown>).decision).toBe("approved");
    expect((doneSteps[3].outputs as Record<string, unknown>).finalizedAfter).toBe("approved");

    // Activity logged for launch, steps, approval, completion
    const log = await db.query.activities.findMany({ where: eq(activities.ploybookRunId, runId) });
    const actionsLogged = log.map((a) => a.action);
    expect(actionsLogged).toContain("run.launched");
    expect(actionsLogged).toContain("step.completed");
    expect(actionsLogged).toContain("approval.requested");
    expect(actionsLogged).toContain("approval.approved");
    expect(actionsLogged).toContain("run.completed");

    // Domain events emitted
    const emitted = await db.select().from(events);
    const types = emitted.map((e) => e.eventType);
    expect(types).toContain("ploybook.run_launched");
    expect(types).toContain("approval.requested");
    expect(types).toContain("ploybook.run_completed");

    // Rejection cannot double-resolve
    await expect(resolveApproval(db, pending!.id, "rejected")).rejects.toThrow(/already/);
  });

  it("records a rejected approval and still completes with the decision visible", async () => {
    const runId = await launchRun(db, { ploybookKey: "pb00_dummy" });
    await executeRun(db, runId);
    const pending = await db.query.approvals.findFirst({ where: eq(approvals.runId, runId) });
    const finalStatus = await resolveApproval(db, pending!.id, "rejected");
    expect(finalStatus).toBe("completed");
    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect((steps[2].outputs as Record<string, unknown>).decision).toBe("rejected");
  });

  it("auto-resumes runs orphaned by a restart (running mid-step, and stale queued)", async () => {
    const { resumeOrphanedRuns } = await import("./runner");
    // Simulate a run whose in-flight step died with the old process
    const orphanId = await launchRun(db, { ploybookKey: "pb00_dummy" });
    await db
      .update(ploybookRuns)
      .set({ status: "running", updatedAt: new Date(Date.now() - 60_000) })
      .where(eq(ploybookRuns.id, orphanId));
    await db
      .update(ploybookSteps)
      .set({ status: "running" })
      .where(and(eq(ploybookSteps.runId, orphanId), eq(ploybookSteps.stepKey, "create_entities")));
    // Simulate a queued run nobody picked up
    const queuedId = await launchRun(db, { ploybookKey: "pb00_dummy" });
    await db
      .update(ploybookRuns)
      .set({ updatedAt: new Date(Date.now() - 5 * 60_000) })
      .where(eq(ploybookRuns.id, queuedId));

    const resumed = await resumeOrphanedRuns(db, { runningOlderThanMs: 0, queuedOlderThanMs: 2 * 60_000 });
    expect(resumed).toBe(2);
    const orphan = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, orphanId) });
    expect(orphan?.status).toBe("waiting_for_approval"); // ran through to the gate
    const picked = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, queuedId) });
    expect(picked?.status).toBe("waiting_for_approval");

    // A freshly-updated running run is NOT touched at steady-state thresholds
    const freshId = await launchRun(db, { ploybookKey: "pb00_dummy" });
    await db.update(ploybookRuns).set({ status: "running" }).where(eq(ploybookRuns.id, freshId));
    expect(await resumeOrphanedRuns(db, { runningOlderThanMs: 30 * 60_000, queuedOlderThanMs: 2 * 60_000 })).toBe(0);
  });

  it("marks a failing step failed, preserves prior work, and retries cleanly", async () => {
    let shouldFail = true;
    const flaky: PloybookDefinition = {
      key: "pb00_flaky",
      name: "Flaky test ploybook",
      description: "fails once then succeeds",
      version: "1.0",
      triggerTypes: ["manual"],
      steps: [
        {
          key: "good",
          name: "Good step",
          async run() {
            return { kind: "completed", outputs: { ok: true } };
          },
        },
        {
          key: "flaky",
          name: "Flaky step",
          async run() {
            if (shouldFail) throw new Error("transient failure");
            return { kind: "completed", outputs: { recovered: true } };
          },
        },
      ],
    };
    registerPloybook(flaky);

    const runId = await launchRun(db, { ploybookKey: "pb00_flaky" });
    expect(await executeRun(db, runId)).toBe("failed");

    const run = await db.query.ploybookRuns.findFirst({ where: eq(ploybookRuns.id, runId) });
    expect(run?.error).toContain("flaky");

    // Prior successful step preserved
    const steps = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect(steps[0].status).toBe("completed");
    expect(steps[1].status).toBe("failed");

    // Retry re-runs only the failed step
    shouldFail = false;
    expect(await retryRun(db, runId)).toBe("completed");
    const after = await db.query.ploybookSteps.findMany({
      where: eq(ploybookSteps.runId, runId),
      orderBy: asc(ploybookSteps.stepOrder),
    });
    expect(after[0].attempts).toBe(1); // not re-executed
    expect(after[1].attempts).toBe(2);
  });
});
