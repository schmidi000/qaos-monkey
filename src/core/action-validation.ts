import type { AgentDecision, QAosMonkeyConfig, ScreenObservation } from "../types.ts";

export function validateDecision(decision: AgentDecision, screen: ScreenObservation, config: QAosMonkeyConfig): string[] {
  const errors: string[] = [];
  if (config.exploration.excludedActions.includes(decision.action)) {
    errors.push(`Action ${decision.action} is excluded by configuration.`);
  }
  const excludedCurrentScreen = findExcludedCurrentScreen(screen.snapshot, config.exploration.excludedScreens);
  if (excludedCurrentScreen && !isSafeOnExcludedScreen(decision)) {
    errors.push(`Current screen title/header matches excluded screen pattern: ${excludedCurrentScreen}`);
  }
  const excludedTarget = findExcludedActionTarget(decision, screen.snapshot, config.exploration.excludedScreens);
  if (excludedTarget) {
    errors.push(`Action target matches excluded screen pattern: ${excludedTarget}`);
  }
  if (decision.action === "tap" && !decision.ref && (typeof decision.x !== "number" || typeof decision.y !== "number")) {
    errors.push("tap requires either a UI ref or x/y coordinates.");
  }
  if (decision.action === "type" && decision.ref && !screen.interactiveRefs.includes(decision.ref)) {
    errors.push(`type target ${decision.ref} is not present in the current UI snapshot.`);
  }
  if (decision.action === "tap" && decision.ref && !screen.interactiveRefs.includes(decision.ref)) {
    errors.push(`tap target ${decision.ref} is not present in the current UI snapshot.`);
  }
  if (decision.action === "wait" && (decision.milliseconds < 0 || decision.milliseconds > 30000)) {
    errors.push("wait milliseconds must be between 0 and 30000.");
  }
  return errors;
}

export function extractInteractiveRefs(snapshot: string): string[] {
  const refs = new Set<string>();
  const regex = /@[a-zA-Z]?\d+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(snapshot))) {
    refs.add(match[0]);
  }
  return [...refs];
}

export function findExcludedCurrentScreen(snapshot: string, patterns: string[]): string | undefined {
  const identityLines = snapshot
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isScreenIdentityLine)
    .slice(0, 8);
  return findMatchingPattern(identityLines, patterns);
}

export function findExcludedActionTarget(decision: AgentDecision, snapshot: string, patterns: string[]): string | undefined {
  if (!("ref" in decision) || !decision.ref || !["tap", "type", "scroll", "swipe"].includes(decision.action)) {
    return undefined;
  }
  const ref = decision.ref;
  const targetLine = snapshot
    .split("\n")
    .find((line) => new RegExp(`(^|\\s)${escapeRegex(ref)}(\\s|$)`).test(line));
  return targetLine ? findMatchingPattern([targetLine], patterns) : undefined;
}

function isSafeOnExcludedScreen(decision: AgentDecision): boolean {
  return ["press_back", "wait", "ask_human", "log_bug", "finish"].includes(decision.action);
}

function isScreenIdentityLine(line: string): boolean {
  if (/\b(button|link|textfield|securetextfield|search|switch|checkbox|slider|tab|cell|image)\b/i.test(line)) {
    return false;
  }
  if (/\b(header|heading|title|navigation|navigationbar|toolbar|statictext|text)\b/i.test(line)) {
    return true;
  }
  return !/@[a-zA-Z]?\d+/.test(line);
}

function findMatchingPattern(lines: string[], patterns: string[]): string | undefined {
  return patterns.find((pattern) => {
    const normalizedPattern = pattern.trim().toLowerCase();
    return normalizedPattern && lines.some((line) => line.toLowerCase().includes(normalizedPattern));
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
