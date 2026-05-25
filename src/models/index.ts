import type { QAosMonkeyConfig, ModelProvider } from "../types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { CliModelProvider } from "./cli-provider.ts";
import { OpenAICompatibleProvider } from "./openai-compatible.ts";

export function createModelProvider(config: QAosMonkeyConfig): ModelProvider {
  if (config.model.provider === "openai-compatible") {
    return new OpenAICompatibleProvider(config);
  }
  if (config.model.provider === "anthropic") {
    return new AnthropicProvider(config);
  }
  if (config.model.provider === "claude-code") {
    return new CliModelProvider(config.model.command ?? ["claude"], "Claude Code");
  }
  return new CliModelProvider(config.model.command ?? ["codex", "exec", "--json"], "Codex CLI");
}

