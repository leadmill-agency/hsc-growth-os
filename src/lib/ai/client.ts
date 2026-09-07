import type { z } from "zod";

// AI abstraction (master PRD §8): provider-agnostic, structured, validated.
// No direct model calls anywhere else in the codebase (§33.6–7).

export interface GenerateStructuredParams<S extends z.ZodType> {
  /** Stable system prompt (kept cache-friendly: static content only). */
  system?: string;
  prompt: string;
  schema: S;
  /** Depth/cost control. Defaults to "high". */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

export interface GenerateTextParams {
  system?: string;
  prompt: string;
  maxTokens?: number;
}

export interface LLMClient {
  generateStructured<S extends z.ZodType>(params: GenerateStructuredParams<S>): Promise<z.infer<S>>;
  generateText(params: GenerateTextParams): Promise<string>;
}

export class LLMRefusalError extends Error {
  constructor(public category: string | null, explanation: string | null) {
    super(`Model refused the request${category ? ` (${category})` : ""}: ${explanation ?? "no explanation"}`);
    this.name = "LLMRefusalError";
  }
}

class AnthropicLLMClient implements LLMClient {
  private clientPromise: Promise<import("@anthropic-ai/sdk").default> | null = null;
  private readonly model = process.env.GROWTH_OS_MODEL ?? "claude-opus-5";

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = import("@anthropic-ai/sdk").then((m) => new m.default());
    }
    return this.clientPromise;
  }

  private checkRefusal(response: { stop_reason: string | null; stop_details?: unknown }) {
    if (response.stop_reason === "refusal") {
      const details = response.stop_details as { category?: string; explanation?: string } | null;
      throw new LLMRefusalError(details?.category ?? null, details?.explanation ?? null);
    }
  }

  async generateStructured<S extends z.ZodType>(
    params: GenerateStructuredParams<S>
  ): Promise<z.infer<S>> {
    const client = await this.getClient();
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const response = await client.messages.parse({
      model: this.model,
      max_tokens: params.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(params.schema),
        ...(params.effort ? { effort: params.effort } : {}),
      },
      ...(params.system ? { system: params.system } : {}),
      messages: [{ role: "user", content: params.prompt }],
    });
    this.checkRefusal(response);
    if (response.parsed_output == null) {
      throw new Error("Structured output failed schema validation");
    }
    // parse() validated against the output format; run zod once more for full type safety.
    return params.schema.parse(response.parsed_output);
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    const client = await this.getClient();
    const response = await client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      ...(params.system ? { system: params.system } : {}),
      messages: [{ role: "user", content: params.prompt }],
    });
    this.checkRefusal(response);
    return response.content
      .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

/**
 * Deterministic client for tests/fixtures (§33.12). Queue responses per call, or
 * provide a resolver keyed by a substring of the prompt.
 */
export class FixtureLLMClient implements LLMClient {
  constructor(
    private fixtures: {
      structured?: Array<unknown> | ((prompt: string) => unknown);
      text?: Array<string> | ((prompt: string) => string);
    } = {}
  ) {}

  async generateStructured<S extends z.ZodType>(
    params: GenerateStructuredParams<S>
  ): Promise<z.infer<S>> {
    const source = this.fixtures.structured;
    if (!source) throw new Error("FixtureLLMClient: no structured fixtures configured");
    const raw = typeof source === "function" ? source(params.prompt) : source.shift();
    if (raw === undefined) throw new Error("FixtureLLMClient: structured fixtures exhausted");
    return params.schema.parse(raw);
  }

  async generateText(params: GenerateTextParams): Promise<string> {
    const source = this.fixtures.text;
    if (!source) throw new Error("FixtureLLMClient: no text fixtures configured");
    const raw = typeof source === "function" ? source(params.prompt) : source.shift();
    if (raw === undefined) throw new Error("FixtureLLMClient: text fixtures exhausted");
    return raw;
  }
}

let override: LLMClient | null = null;

/** Test hook: inject a FixtureLLMClient. */
export function setLLMClientForTests(client: LLMClient | null) {
  override = client;
}

export function getLLMClient(): LLMClient {
  if (override) return override;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. In tests, inject a FixtureLLMClient via setLLMClientForTests()."
    );
  }
  return new AnthropicLLMClient();
}
