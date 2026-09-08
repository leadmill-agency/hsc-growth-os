// Live-research abstraction (master PRD §33.5): integrations behind adapters,
// with fixture fallbacks so every ploybook runs with zero live connectors.
// Per Rameel 2026-09-07: live research is powered by OpenAI (web search).

export interface ResearchResult {
  text: string;
  sources: { url: string; title?: string }[];
}

export interface ResearchProvider {
  /** Run one web-research query and return synthesized findings with source URLs. */
  research(params: { query: string; focus?: string }): Promise<ResearchResult>;
}

export class FixtureResearchProvider implements ResearchProvider {
  constructor(private resolver: (query: string) => ResearchResult) {}
  async research(params: { query: string }): Promise<ResearchResult> {
    return this.resolver(params.query);
  }
}

let override: ResearchProvider | null = null;

export function setResearchProviderForTests(provider: ResearchProvider | null) {
  override = provider;
}

export async function getResearchProvider(): Promise<ResearchProvider> {
  if (override) return override;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set. In tests, inject a FixtureResearchProvider via setResearchProviderForTests()."
    );
  }
  const { OpenAIResearchProvider } = await import("./openai");
  return new OpenAIResearchProvider();
}
