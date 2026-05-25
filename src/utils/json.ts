import type { AgentDecision } from "../types.ts";

const validActions = new Set([
  "tap",
  "type",
  "scroll",
  "swipe",
  "press_back",
  "dismiss_overlay",
  "wait",
  "ask_human",
  "log_bug",
  "finish"
]);

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model output did not contain a JSON object.");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

export function parseDecision(text: string): AgentDecision {
  const value = extractJsonObject(text);
  if (!value || typeof value !== "object") {
    throw new Error("Model decision must be an object.");
  }
  const decision = value as Record<string, unknown>;
  if (typeof decision.action !== "string" || !validActions.has(decision.action)) {
    throw new Error(`Unsupported model action: ${String(decision.action)}`);
  }
  if (decision.action === "type" && typeof decision.value !== "string") {
    throw new Error("type decision requires a string value.");
  }
  if ((decision.action === "scroll" || decision.action === "swipe") && !["up", "down", "left", "right"].includes(String(decision.direction))) {
    throw new Error(`${decision.action} decision requires direction up, down, left, or right.`);
  }
  if (decision.action === "wait" && typeof decision.milliseconds !== "number") {
    throw new Error("wait decision requires milliseconds.");
  }
  if (decision.action === "ask_human" && typeof decision.reason !== "string") {
    throw new Error("ask_human decision requires a reason.");
  }
  if (decision.action !== "log_bug" && decision.action !== "ask_human" && decision.action !== "finish" && typeof decision.reason !== "string") {
    decision.reason = "No reason provided.";
  }
  return decision as AgentDecision;
}
