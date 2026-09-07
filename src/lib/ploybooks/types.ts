import type { Db } from "@/lib/db/client";

// Ploybook definition standard (master PRD §11). Definitions are code, but readable as config:
// explicit ordered steps, explicit approval gates, no free-form autonomous loops (§33.15).

export type StepStatus =
  | "pending"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "skipped";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface StepContext {
  db: Db;
  runId: string;
  ploybookKey: string;
  triggerPayload: Record<string, unknown>;
  primaryEntityType?: string;
  primaryEntityId?: string;
  /** Outputs of previously completed steps in this run, keyed by step key. */
  priorOutputs: Record<string, Record<string, unknown>>;
  /** Present when this step is resuming after an approval was resolved. */
  approvalResolution?: {
    status: "approved" | "rejected" | "edited";
    payload: Record<string, unknown> | null;
    resolvedBy: string | null;
  };
}

export type StepResult =
  | { kind: "completed"; outputs?: Record<string, unknown> }
  | {
      /** Pause the run and create an Approval (§16). Runner resumes this step on resolution. */
      kind: "needs_approval";
      approval: {
        approvalType: string;
        title: string;
        summary?: string;
        proposedAction?: string;
        payload?: Record<string, unknown>;
      };
    }
  | { kind: "skipped"; reason: string };

export interface StepDefinition {
  key: string;
  /** Human label shown in the run timeline. */
  name: string;
  run(ctx: StepContext): Promise<StepResult>;
}

export interface PloybookDefinition {
  key: string;
  name: string;
  description: string;
  version: string;
  triggerTypes: string[];
  steps: StepDefinition[];
}
