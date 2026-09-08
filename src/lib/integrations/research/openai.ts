import type { ResearchProvider, ResearchResult } from "./provider";

// OpenAI-backed live research using the Responses API with the web_search tool.
// This module is only imported when OPENAI_API_KEY is present.

export class OpenAIResearchProvider implements ResearchProvider {
  private clientPromise: Promise<import("openai").default> | null = null;
  private readonly model = process.env.OPENAI_RESEARCH_MODEL ?? "gpt-5";

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = import("openai").then((m) => new m.default());
    }
    return this.clientPromise;
  }

  async research(params: { query: string; focus?: string }): Promise<ResearchResult> {
    const client = await this.getClient();
    const instructions =
      "You are a commercial research analyst for a Houston sign company. " +
      "Search the web and report only what you actually find, with concrete facts and dates. " +
      "Clearly say when something could not be verified. Never invent contacts, projects, or figures." +
      (params.focus ? ` Focus: ${params.focus}` : "");

    const response = await client.responses.create({
      model: this.model,
      tools: [{ type: "web_search" }],
      instructions,
      input: params.query,
    });

    const sources: ResearchResult["sources"] = [];
    for (const item of response.output ?? []) {
      if (item.type === "message") {
        for (const block of item.content ?? []) {
          if (block.type === "output_text") {
            for (const ann of block.annotations ?? []) {
              if (ann.type === "url_citation" && ann.url && !sources.some((s) => s.url === ann.url)) {
                sources.push({ url: ann.url, title: "title" in ann ? ann.title : undefined });
              }
            }
          }
        }
      }
    }

    return { text: response.output_text ?? "", sources };
  }
}
