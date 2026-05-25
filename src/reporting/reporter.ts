import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding, Reporter, RunState, StepRecord } from "../types.ts";

export class FileReporter implements Reporter {
  constructor(private runDir: string) {}

  async recordStep(_step: StepRecord): Promise<void> {
    return;
  }

  async recordFinding(_finding: Finding): Promise<void> {
    return;
  }

  async finalizeReport(state: RunState): Promise<void> {
    await writeFile(join(this.runDir, "report.json"), JSON.stringify(toReportJson(state), null, 2), "utf8");
    await writeFile(join(this.runDir, "report.md"), toMarkdownReport(state), "utf8");
  }
}

export function dedupeFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${finding.category}:${finding.title}:${finding.screenSignature ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...finding });
      continue;
    }
    existing.lastSeenStep = Math.max(existing.lastSeenStep, finding.lastSeenStep);
    existing.screenshots = [...new Set([...existing.screenshots, ...finding.screenshots])];
    existing.logs = existing.logs ?? finding.logs;
  }
  return [...byKey.values()];
}

function toReportJson(state: RunState): unknown {
  return {
    runId: state.id,
    status: state.status,
    startedAt: state.startedAt,
    updatedAt: state.updatedAt,
    steps: state.steps,
    findings: dedupeFindings(state.findings),
    coverage: coverage(state)
  };
}

function toMarkdownReport(state: RunState): string {
  const findings = dedupeFindings(state.findings);
  const cov = coverage(state);
  const lines = [
    `# QAosMonkey Report`,
    ``,
    `Run: ${state.id}`,
    `Status: ${state.status}`,
    `Started: ${state.startedAt}`,
    `Updated: ${state.updatedAt}`,
    ``,
    `## Summary`,
    ``,
    `- Steps executed: ${state.steps.length}`,
    `- Unique screens visited: ${cov.uniqueScreens}`,
    `- Findings: ${findings.length}`,
    `- Blockers: ${cov.blockers}`,
    ``,
    `## Findings`,
    ``
  ];
  if (findings.length === 0) {
    lines.push(`No findings were logged.`);
  }
  for (const finding of findings) {
    lines.push(
      `### ${finding.severity.toUpperCase()}: ${finding.title}`,
      ``,
      `Category: ${finding.category}`,
      `Confidence: ${finding.confidence}`,
      `First seen step: ${finding.firstSeenStep}`,
      ``,
      finding.description,
      ``,
      `Expected: ${finding.expected ?? "Not specified"}`,
      `Actual: ${finding.actual ?? "Not specified"}`,
      ``,
      `Steps to reproduce:`,
      ...finding.stepsToReproduce.map((step, index) => `${index + 1}. ${step}`),
      ``,
      finding.screenshots.length ? `Screenshots: ${finding.screenshots.join(", ")}` : `Screenshots: none`,
      ``
    );
  }
  lines.push(
    `## Coverage`,
    ``,
    `Visited screens: ${cov.uniqueScreens}`,
    `Actions tried: ${cov.actionsTried.join(", ") || "none"}`,
    ``,
    `## Recent Trace`,
    ``,
    ...state.steps.slice(-25).map((step) => `- ${step.index}: ${step.decision.action} -> ${step.result.status} (${step.result.message})`)
  );
  return `${lines.join("\n")}\n`;
}

function coverage(state: RunState) {
  return {
    uniqueScreens: state.screenGraph.nodes.length,
    blockers: state.steps.filter((step) => step.result.status === "blocker").length,
    actionsTried: [...new Set(state.steps.map((step) => step.decision.action))]
  };
}

