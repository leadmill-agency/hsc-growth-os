import type { PloybookDefinition } from "../types";
import { createAccount } from "@/lib/actions/entities";
import { researchAccountBrief } from "@/lib/actions/research";

// PB09 — Account Research Brief. Also invoked as a shared action by other ploybooks;
// this standalone definition lets it run from the UI on any account name.

export const pb09AccountResearch: PloybookDefinition = {
  key: "pb09_account_research",
  name: "PB09 — Account Research Brief",
  description:
    "Generates one reusable, evidence-backed research brief for an account (company, HSC fit, people, projects, signals, recommended motion) and writes structured fields back.",
  version: "1.0",
  triggerTypes: ["manual", "ploybook"],
  steps: [
    {
      key: "resolve_account",
      name: "Resolve account",
      async run(ctx) {
        const payload = ctx.triggerPayload as { accountName?: string; website?: string };
        if (!payload.accountName) throw new Error("accountName is required");
        const { account } = await createAccount(ctx.db, {
          name: payload.accountName,
          website: payload.website,
          ploybookRunId: ctx.runId,
        });
        return { kind: "completed", outputs: { accountId: account.id, accountName: account.name } };
      },
    },
    {
      key: "research_brief",
      name: "Research and write brief",
      async run(ctx) {
        const prior = ctx.priorOutputs["resolve_account"];
        const { brief, sources } = await researchAccountBrief(ctx.db, {
          accountId: prior.accountId as string,
          accountName: prior.accountName as string,
          ploybookRunId: ctx.runId,
        });
        // The readable brief the account page renders whole (2026-09-11).
        const { saveAccountResearchBrief, briefFromResearch } = await import(
          "@/lib/actions/research-brief"
        );
        await saveAccountResearchBrief(ctx.db, {
          accountId: prior.accountId as string,
          ploybookRunId: ctx.runId,
          brief: briefFromResearch(brief, sources.map((s) => s.url), "pb09_account_research"),
        });
        return { kind: "completed", outputs: { brief, sources } };
      },
    },
  ],
};
