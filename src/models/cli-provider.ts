import type { DecisionContext, ModelProvider } from "../types.ts";
import { parseDecision } from "../utils/json.ts";
import { runCommandOrThrowWithOptions } from "../utils/subprocess.ts";
import { buildDecisionPrompt } from "./prompt.ts";

export class CliModelProvider implements ModelProvider {
  constructor(private command: string[], private label: string) {}

  async decideNextAction(context: DecisionContext) {
    if (!this.command.length) {
      throw new Error(`${this.label} provider requires model.command in config.`);
    }
    const prompt = buildDecisionPrompt(context);
    const progress = createCliProgressLogger(this.label);
    const stdout = await runCommandOrThrowWithOptions(this.command, prompt, {
      timeoutMs: 180000,
      heartbeatMs: 10000,
      onHeartbeat: (elapsedMs) => {
        console.log(`[qaosmonkey] Still waiting for ${this.label} (${Math.round(elapsedMs / 1000)}s elapsed)...`);
      },
      onStdoutData: progress.stdout,
      onStderrData: progress.stderr
    });
    progress.flush();
    return parseDecision(extractDecisionText(stdout));
  }
}

export function extractDecisionText(stdout: string): string {
  try {
    parseDecision(stdout);
    return stdout;
  } catch {
    const messages: string[] = [];
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) {
        continue;
      }
      try {
        const event = JSON.parse(trimmed) as { type?: string; item?: { type?: string; text?: string }; text?: string };
        if (typeof event.text === "string") {
          messages.push(event.text);
        }
        if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") {
          messages.push(event.item.text);
        }
      } catch {
        continue;
      }
    }
    const lastMessage = messages.at(-1);
    if (lastMessage) {
      return lastMessage;
    }
    return stdout;
  }
}

function createCliProgressLogger(label: string) {
  let stdoutBuffer = "";
  let stderrBuffer = "";
  return {
    stdout(chunk: string) {
      stdoutBuffer = logCompletedLines(`${stdoutBuffer}${chunk}`, (line) => logModelStdoutLine(label, line));
    },
    stderr(chunk: string) {
      stderrBuffer = logCompletedLines(`${stderrBuffer}${chunk}`, (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          console.log(`[qaosmonkey] ${label}: ${trimmed}`);
        }
      });
    },
    flush() {
      if (stdoutBuffer.trim()) {
        logModelStdoutLine(label, stdoutBuffer);
      }
      if (stderrBuffer.trim()) {
        console.log(`[qaosmonkey] ${label}: ${stderrBuffer.trim()}`);
      }
      stdoutBuffer = "";
      stderrBuffer = "";
    }
  };
}

function logCompletedLines(buffer: string, logLine: (line: string) => void): string {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";
  for (const line of lines) {
    logLine(line);
  }
  return rest;
}

function logModelStdoutLine(label: string, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    return;
  }
  if (!trimmed.startsWith("{")) {
    console.log(`[qaosmonkey] ${label}: ${trimmed}`);
    return;
  }
  try {
    const event = JSON.parse(trimmed) as {
      type?: string;
      item?: { type?: string; text?: string };
      text?: string;
      message?: string;
    };
    if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") {
      try {
        const decision = parseDecision(event.item.text);
        console.log(`[qaosmonkey] ${label} decided: ${summarizeDecision(decision)}`);
      } catch {
        console.log(`[qaosmonkey] ${label} produced an agent message.`);
      }
      return;
    }
    if (event.type === "item.completed" && event.item?.type) {
      console.log(`[qaosmonkey] ${label} completed ${event.item.type}.`);
      return;
    }
    if (event.type === "turn.completed") {
      console.log(`[qaosmonkey] ${label} turn completed.`);
      return;
    }
    if (event.type === "error" && event.message) {
      console.log(`[qaosmonkey] ${label} error: ${event.message}`);
      return;
    }
    if (event.type) {
      console.log(`[qaosmonkey] ${label}: ${event.type}`);
    }
  } catch {
    console.log(`[qaosmonkey] ${label}: ${trimmed}`);
  }
}

function summarizeDecision(decision: ReturnType<typeof parseDecision>): string {
  if ("ref" in decision && decision.ref) {
    return `${decision.action} ${decision.ref}`;
  }
  if (decision.action === "tap" && typeof decision.x === "number" && typeof decision.y === "number") {
    return `tap (${decision.x}, ${decision.y})`;
  }
  if (decision.action === "wait") {
    return `wait ${decision.milliseconds}ms`;
  }
  if (decision.action === "log_bug") {
    return `log_bug ${decision.finding.severity}/${decision.finding.category}: ${decision.finding.title}`;
  }
  return decision.action;
}
