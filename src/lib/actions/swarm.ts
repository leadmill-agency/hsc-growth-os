import { z } from "zod";

// PB06 helpers. Hard rule (PB06 §Rule): never send identical messages to multiple
// people at one account. Distinctness is enforced in code, not left to the model.

export const swarmPlanSchema = z.object({
  people: z.array(
    z.object({
      contact_name: z.string(),
      role_type: z.string(),
      influence: z.number().min(0).max(100),
      hook: z.string(),
      day_offset: z.number().min(0).max(30),
    })
  ),
  sequencing_rationale: z.string(),
});

export type SwarmPlan = z.infer<typeof swarmPlanSchema>;

export const swarmMessagesSchema = z.object({
  messages: z.array(
    z.object({
      contact_name: z.string(),
      subject: z.string(),
      body: z.string(),
      day_offset: z.number(),
    })
  ),
});

export type SwarmMessages = z.infer<typeof swarmMessagesSchema>;

/** Word-set Jaccard similarity, 0..1. Cheap but effective for near-duplicate detection. */
export function messageSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.toLowerCase().match(/[a-z']+/g) ?? []);
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

export const MAX_MESSAGE_SIMILARITY = 0.75;
export const MAX_MESSAGE_WORDS = 150;

/** Throws when messages are near-duplicates or too long — visible failure (§23). */
export function validateSwarmMessages(messages: SwarmMessages["messages"]) {
  for (const message of messages) {
    const words = message.body.trim().split(/\s+/).length;
    if (words > MAX_MESSAGE_WORDS) {
      throw new Error(`Message to ${message.contact_name} is ${words} words (max ${MAX_MESSAGE_WORDS})`);
    }
  }
  for (let i = 0; i < messages.length; i++) {
    for (let j = i + 1; j < messages.length; j++) {
      const similarity = messageSimilarity(messages[i].body, messages[j].body);
      if (similarity > MAX_MESSAGE_SIMILARITY) {
        throw new Error(
          `Messages to ${messages[i].contact_name} and ${messages[j].contact_name} are ${Math.round(similarity * 100)}% similar — swarm messages must be distinct`
        );
      }
    }
  }
}
