import { readFile } from "node:fs/promises";
import type { QAosMonkeyConfig, DecisionContext, ModelProvider } from "../types.ts";
import { parseDecision } from "../utils/json.ts";
import { buildDecisionPrompt } from "./prompt.ts";

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private config: QAosMonkeyConfig) {}

  async decideNextAction(context: DecisionContext) {
    const apiKeyEnv = this.config.model.apiKeyEnv ?? "OPENAI_API_KEY";
    const apiKey = process.env[apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key environment variable: ${apiKeyEnv}`);
    }
    const baseUrl = this.config.model.baseUrl ?? "https://api.openai.com/v1";
    const content: Array<Record<string, unknown>> = [{ type: "text", text: buildDecisionPrompt(context) }];
    if (this.config.model.vision && context.currentScreen.screenshotPath) {
      const image = await readFile(context.currentScreen.screenshotPath);
      content.push({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${image.toString("base64")}` }
      });
    }
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model.model ?? "gpt-4o",
        temperature: this.config.model.temperature ?? 0.4,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed: ${response.status} ${await response.text()}`);
    }
    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return parseDecision(json.choices?.[0]?.message?.content ?? "");
  }
}

