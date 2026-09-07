import type { PloybookDefinition } from "../types";
import { createAccount, createProject, createOpportunity, saveEvidence } from "@/lib/actions/entities";

// PB00 — Phase 0 gate ploybook (master PRD §26 Phase 0 acceptance criteria).
// Exercises: entity creation via shared actions, evidence, approval pause/resume, activity.
// Not a business ploybook; stays registered as the engine's smoke test.

export const pb00Dummy: PloybookDefinition = {
  key: "pb00_dummy",
  name: "PB00 — Engine Smoke Test",
  description:
    "Creates a test account/project/opportunity, records evidence, pauses for approval, and completes. Used to verify the Ploybook engine end-to-end.",
  version: "1.0",
  triggerTypes: ["manual"],
  steps: [
    {
      key: "create_entities",
      name: "Create account, project, opportunity",
      async run(ctx) {
        const payload = ctx.triggerPayload as {
          accountName?: string;
          projectName?: string;
          website?: string;
        };
        const { account } = await createAccount(ctx.db, {
          name: payload.accountName ?? "Smoke Test GC",
          accountType: "general_contractor",
          website: payload.website,
          ploybookRunId: ctx.runId,
        });
        const { project } = await createProject(ctx.db, {
          name: payload.projectName ?? "Smoke Test Project",
          city: "Houston",
          state: "TX",
          stage: "bidding",
          gcAccountId: account.id,
          source: "fixture",
          ploybookRunId: ctx.runId,
        });
        const { opportunity } = await createOpportunity(ctx.db, {
          name: `${account.name} — ${project.name}`,
          accountId: account.id,
          projectId: project.id,
          opportunityType: "signage",
          tradeScope: "channel letters",
          source: "fixture",
          ploybookRunId: ctx.runId,
        });
        return {
          kind: "completed",
          outputs: { accountId: account.id, projectId: project.id, opportunityId: opportunity.id },
        };
      },
    },
    {
      key: "record_evidence",
      name: "Record source evidence",
      async run(ctx) {
        const prior = ctx.priorOutputs["create_entities"];
        await saveEvidence(ctx.db, {
          entityType: "opportunity",
          entityId: prior.opportunityId as string,
          fieldName: "trade_scope",
          value: "channel letters",
          sourceName: "fixture",
          confidence: 0.9,
          verificationStatus: "assumed",
        });
        return { kind: "completed", outputs: { evidenceRecorded: true } };
      },
    },
    {
      key: "request_approval",
      name: "Request human approval",
      async run(ctx) {
        if (!ctx.approvalResolution) {
          return {
            kind: "needs_approval",
            approval: {
              approvalType: "smoke_test",
              title: "Approve smoke-test completion",
              summary: "Engine smoke test is pausing for human approval, per §16.",
              proposedAction: "Mark the smoke-test opportunity as reviewed.",
              payload: { opportunityId: ctx.priorOutputs["create_entities"]?.opportunityId },
            },
          };
        }
        return {
          kind: "completed",
          outputs: { decision: ctx.approvalResolution.status },
        };
      },
    },
    {
      key: "finalize",
      name: "Finalize",
      async run(ctx) {
        const decision = ctx.priorOutputs["request_approval"]?.decision;
        return { kind: "completed", outputs: { finalizedAfter: decision ?? "unknown" } };
      },
    },
  ],
};
