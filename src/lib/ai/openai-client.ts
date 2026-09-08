import { z } from "zod";
import type { GenerateStructuredParams, GenerateTextParams, LLMClient } from "./client";

// OpenAI-backed LLMClient (per Rameel 2026-09-07: OpenAI powers live AI work for now).
// Structured outputs via chat.completions response_format json_schema, validated with zod.

export class OpenAILLMClient implements LLMClient {
  private clientPromise: Promise<import("openai").default> | null = null;
  private readonly model = process.env.OPENAI_STRUCTURED_MODEL ?? "gpt-5-mini";

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = import("openai").then((m) => new m.default());
    }
    return this.clientPromise;
  }

  async generateStructured<S extends z.ZodType>(
    params: GenerateStructuredParams<S>
  ): Promise<z.infer<S>> {
    const client = await this.getClient();
    const jsonSchema = z.toJSONSchema(params.schema);
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
        { role: "user" as const, content: params.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "structured_output", strict: false, schema: jsonSchema },
      },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned no content for structured request");
    return params.schema.parse(JSON.parse(content));
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    const client = await this.getClient();
    const response = await client.chat.completions.create({
      model: this.model,
      messages: [
        ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
        { role: "user" as const, content: params.prompt },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
