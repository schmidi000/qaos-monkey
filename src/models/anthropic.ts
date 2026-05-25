import { readFile } from "node:fs/promises";
import type { QAosMonkeyConfig, DecisionContext, ModelProvider } from "../types.ts";
import { parseDecision } from "../utils/json.ts";
import { buildDecisionPrompt } from "./prompt.ts";

export class AnthropicProvider implements ModelProvider {
  constructor(private config: QAosMonkeyConfig) {}

  async decideNextAction(context: DecisionContext) {
    const apiKeyEnv = this.config.model.apiKeyEnv ?? "ANTHROPIC_API_KEY";
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key environment variable: ${apiKeyEnv}`);
    }
    const content: Array<Record<string, unknown>> = [{ type: "text", text: buildDecisionPrompt(context) }];
    if (this.config.model.vision && context.currentScreen.screenshotPath) {
      const image = await readFile(context.currentScreen.screenshotPath);
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: image.toString("base64") }
      });
    }
    const response = await fetch(`${(this.config.model.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.config.model.model ?? "claude-3-5-sonnet-latest",
        max_tokens: 1200,
        temperature: this.config.model.temperature ?? 0.4,
        messages: [{ role: "user", content }]
      })
    });
    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
    }
    const json = await response.json() as { content?: Array<{ type: string; text?: string }> };
    return parseDecision(json.content?.find((item) => item.type === "text")?.text ?? "");
  }
}

