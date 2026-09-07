import { z } from "zod";

// Required agent output envelope (master PRD §22 + PB PRDs §9).
// Every ploybook-facing AI response uses this shape. If the model lacks evidence,
// the item goes in `unknowns` — never silently filled in.

export const evidenceStatusSchema = z.enum(["verified", "inferred", "assumed", "unknown"]);

export const envelopeFactSchema = z.object({
  field: z.string(),
  value: z.string(),
  status: evidenceStatusSchema,
  confidence: z.number().min(0).max(1),
  source: z.string().nullable(),
});

export const agentEnvelopeSchema = z.object({
  summary: z.string(),
  facts: z.array(envelopeFactSchema),
  assumptions: z.array(z.string()),
  unknowns: z.array(z.string()),
  risks: z.array(z.string()),
  recommended_next_action: z.object({
    action: z.string(),
    reason: z.string(),
    requires_approval: z.boolean(),
  }),
  writebacks: z.array(
    z.object({
      entity_type: z.string(),
      field: z.string(),
      value: z.string(),
      status: evidenceStatusSchema,
    })
  ),
  child_ploybook_suggestions: z.array(z.string()),
});

export type AgentEnvelope = z.infer<typeof agentEnvelopeSchema>;
