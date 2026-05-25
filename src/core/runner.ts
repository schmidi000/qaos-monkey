import { basename, join, resolve } from "node:path";
import type {
  ActionResult,
  AgentDecision,
  QAosMonkeyConfig,
  DeviceDriver,
  Finding,
  HumanInputProvider,
  ModelProvider,
  RunState,
  RuntimeCredential,
  ScreenObservation,
  StepRecord
} from "../types.ts";
import { extractInteractiveRefs, validateDecision } from "./action-validation.ts";
import { ScreenGraph } from "./screen-graph.ts";
import { StateStore } from "./state-store.ts";
import { normalizeSnapshot, sha1 } from "../utils/hash.ts";
import { FileReporter, dedupeFindings } from "../reporting/reporter.ts";
import { resolveCredentials, SecretRedactor } from "../credentials.ts";

export interface RunnerOptions {
  config: QAosMonkeyConfig;
  configPath: string;
  driver: DeviceDriver;
  model: ModelProvider;
  human: HumanInputProvider;
}

export class Runner {
  private store: StateStore;
  private credentials: RuntimeCredential[];
  private redactor: SecretRedactor;

  constructor(private options: RunnerOptions) {
    this.store = new StateStore(options.config.reporting.outputDir);
    this.credentials = resolveCredentials(options.config);
    this.redactor = new SecretRedactor(this.credentials);
  }

  async start(): Promise<RunState> {
    const id = createRunId();
    const runDir = resolve(this.options.config.reporting.outputDir, id);
    const now = new Date().toISOString();
    const state: RunState = {
      id,
      startedAt: now,
      updatedAt: now,
      status: "running",
      currentStep: 0,
      configPath: this.options.configPath,
      runDir,
      steps: [],
      findings: [],
      screenGraph: { nodes: [], edges: [] }
    };
    await this.store.createRun(state);
    this.log(`Run ${state.id} started.`);
    this.log(`Artifacts: ${state.runDir}`);
    this.log("Launching app...");
    await this.options.driver.launchApp();
    return this.loop(state);
  }

  async resume(runId: string): Promise<RunState> {
    const state = await this.store.loadRun(runId);
    if (state.status === "finished" || state.status === "aborted") {
      return state;
    }
    if (state.pendingHumanRequest) {
      const response = await this.options.human.requestHelp(
        state.pendingHumanRequest.reason,
        state.pendingHumanRequest.screen,
        state.pendingHumanRequest.options
      );
      if (response.kind === "abort") {
        state.status = "aborted";
        state.pendingHumanRequest = undefined;
        await this.finalize(state);
        return state;
      }
      state.steps.push({
        index: state.currentStep++,
        at: new Date().toISOString(),
        screenSignature: state.pendingHumanRequest.screen?.signature ?? "unknown",
        decision: { action: "ask_human", reason: state.pendingHumanRequest.reason, options: state.pendingHumanRequest.options },
        result: { status: response.kind === "skip" ? "skipped" : "progress", message: humanResultMessage(response) }
      });
      state.pendingHumanRequest = undefined;
      state.status = "running";
      await this.store.saveState(state);
    }
    return this.loop(state);
  }

  private async loop(state: RunState): Promise<RunState> {
    const started = Date.now();
    const graph = ScreenGraph.fromSnapshot(state.screenGraph);
    const reporter = new FileReporter(state.runDir);
    while (state.currentStep < this.options.config.exploration.maxSteps) {
      if (Date.now() - started > this.options.config.exploration.timeLimitSeconds * 1000) {
        this.log(`Time limit reached after ${this.options.config.exploration.timeLimitSeconds}s.`);
        state.status = "finished";
        break;
      }
      this.log(`Step ${state.currentStep + 1}/${this.options.config.exploration.maxSteps}: observing screen...`);
      const before = await this.observe(state, state.currentStep);
      this.log(`Screen ${shortSignature(before.signature)} with ${before.interactiveRefs.length} interactive refs.`);
      const visits = graph.visit(before.signature, before.snapshot);
      if (visits > this.options.config.exploration.maxRepeatedScreenVisits) {
        this.log(`Screen visit limit reached for ${shortSignature(before.signature)} (${visits} visits).`);
        state.findings.push(this.createFinding("medium", "blocker", "Repeated screen visit limit reached", `Screen ${before.signature} was visited ${visits} times.`, state, before));
      }
      state.screenGraph = graph.toJSON();
      this.log("Asking model for next action...");
      const rawDecision = await this.options.model.decideNextAction({
        runId: state.id,
        stepIndex: state.currentStep,
        goal: this.options.config.exploration.goal,
        persona: this.options.config.exploration.persona,
        mustTest: this.options.config.exploration.mustTest ?? [],
        destructiveLevel: this.options.config.exploration.destructiveLevel,
        currentScreen: before,
        recentSteps: state.steps.slice(-(this.options.config.model.maxContextMessages ?? 30)),
        credentials: this.credentials,
        screenGraph: state.screenGraph,
        guardrails: {
          maxSteps: this.options.config.exploration.maxSteps,
          excludedActions: this.options.config.exploration.excludedActions,
          excludedScreens: this.options.config.exploration.excludedScreens,
          allowlistRiskyAreas: this.options.config.exploration.allowlistRiskyAreas
        }
      });
      const decision = this.preventPrematureFinish(rawDecision, state, before);
      this.log(`Model chose ${this.redactor.text(summarizeDecision(decision))}.`);
      const result = await this.applyDecision(state, decision, before, graph);
      this.log(`Result: ${result.status} - ${this.redactor.text(result.message)}`);
      const step: StepRecord = this.redactor.step({
        index: state.currentStep++,
        at: new Date().toISOString(),
        screenSignature: before.signature,
        decision,
        result
      });
      state.steps.push(step);
      state.findings = dedupeFindings(state.findings);
      state.screenGraph = graph.toJSON();
      await reporter.recordStep(step);
      await this.store.appendStep(state.id, step);
      await this.store.saveState(state);
      if (state.status === "paused" || state.status === "aborted" || state.status === "finished") {
        break;
      }
    }
    if (state.currentStep >= this.options.config.exploration.maxSteps && state.status === "running") {
      this.log(`Max steps reached (${this.options.config.exploration.maxSteps}).`);
      state.status = "finished";
    }
    if (state.status !== "paused") {
      await this.finalize(state);
    }
    return state;
  }

  private async applyDecision(state: RunState, decision: AgentDecision, before: ScreenObservation, graph: ScreenGraph): Promise<ActionResult> {
    const validationErrors = validateDecision(decision, before, this.options.config);
    if (validationErrors.length) {
      this.log(`Skipping invalid action: ${validationErrors.join(" ")}`);
      return { status: "skipped", message: validationErrors.join(" "), beforeSignature: before.signature };
    }
    if (decision.action === "ask_human") {
      this.log(`Pausing for human input: ${this.redactor.text(decision.reason)}`);
      state.status = "paused";
      state.pendingHumanRequest = {
        reason: this.redactor.text(decision.reason),
        options: decision.options ?? [],
        screen: before
      };
      await this.store.saveState(state);
      if (process.env.QAOSMONKEY_NON_INTERACTIVE === "1" || process.env.CHAIOS_NON_INTERACTIVE === "1") {
        return { status: "blocker", message: this.redactor.text(decision.reason), beforeSignature: before.signature };
      }
      const response = await this.options.human.requestHelp(decision.reason, before, decision.options);
      state.pendingHumanRequest = undefined;
      if (response.kind === "abort") {
        state.status = "aborted";
        return { status: "blocker", message: "Human aborted run.", beforeSignature: before.signature };
      }
      state.status = "running";
      return { status: response.kind === "skip" ? "skipped" : "progress", message: this.redactor.text(humanResultMessage(response)), beforeSignature: before.signature };
    }
    if (decision.action === "log_bug") {
      state.findings.push(this.findingFromDecision(decision, state, before));
      return { status: "bug", message: this.redactor.text(decision.reason), beforeSignature: before.signature };
    }
    if (decision.action === "finish") {
      state.status = "finished";
      return { status: "finished", message: this.redactor.text(decision.reason), beforeSignature: before.signature };
    }
    try {
      this.log(`Executing ${this.redactor.text(summarizeDecision(decision))}...`);
      await executeDeviceDecision(this.options.driver, decision);
      this.log("Reading result screen...");
      const after = await this.observe(state, state.currentStep, false);
      graph.visit(after.signature, after.snapshot);
      graph.edge(before.signature, after.signature, decision);
      const crash = detectCrash(after.logs);
      if (crash) {
        state.findings.push(this.createFinding("critical", "crash", "Crash or fatal error detected", crash, state, after));
        return { status: "crash", message: this.redactor.text(crash), beforeSignature: before.signature, afterSignature: after.signature };
      }
      if (after.signature === before.signature && decision.action !== "wait") {
        return { status: "no-op", message: "Screen did not appear to change after action.", beforeSignature: before.signature, afterSignature: after.signature };
      }
      return { status: "progress", message: "Action executed.", beforeSignature: before.signature, afterSignature: after.signature };
    } catch (error) {
      return {
        status: "failed",
        message: "Device action failed.",
        beforeSignature: before.signature,
        error: this.redactor.text(error instanceof Error ? error.message : String(error))
      };
    }
  }

  private preventPrematureFinish(decision: AgentDecision, state: RunState, screen: ScreenObservation): AgentDecision {
    if (decision.action !== "finish") {
      return decision;
    }
    const minimum = Math.min(
      this.options.config.exploration.minimumStepsBeforeFinish ?? 0,
      this.options.config.exploration.maxSteps
    );
    if (state.currentStep >= minimum) {
      return decision;
    }
    return chooseFallbackExplorationAction(screen, state.steps) ?? {
      action: "wait",
      milliseconds: 1000,
      reason: `Model tried to finish at step ${state.currentStep}, before minimumStepsBeforeFinish=${minimum}. Waiting because no safe fallback target was found.`
    };
  }

  private async observe(state: RunState, stepIndex: number, captureScreenshot = true): Promise<ScreenObservation> {
    const screenshotPath = captureScreenshot && this.options.config.reporting.retainScreenshots
      ? join(state.runDir, "screenshots", `${String(stepIndex).padStart(4, "0")}.png`)
      : undefined;
    const [snapshot, logs, screenshot] = await Promise.all([
      this.options.driver.snapshot(),
      this.options.driver.getLogs().catch((error) => `Unable to collect logs: ${error instanceof Error ? error.message : String(error)}`),
      screenshotPath ? this.options.driver.screenshot(screenshotPath).catch(() => undefined) : Promise.resolve(undefined)
    ]);
    const normalized = normalizeSnapshot(snapshot);
    return {
      snapshot,
      logs,
      screenshotPath: screenshot,
      signature: sha1(normalized),
      interactiveRefs: extractInteractiveRefs(snapshot)
    };
  }

  private findingFromDecision(decision: Extract<AgentDecision, { action: "log_bug" }>, state: RunState, screen: ScreenObservation): Finding {
    return this.redactor.finding({
      ...decision.finding,
      id: sha1(`${decision.finding.category}:${decision.finding.title}:${screen.signature}`),
      firstSeenStep: state.currentStep,
      lastSeenStep: state.currentStep,
      screenSignature: screen.signature,
      screenshots: screen.screenshotPath ? [screen.screenshotPath] : [],
      logs: screen.logs
    });
  }

  private createFinding(
    severity: Finding["severity"],
    category: Finding["category"],
    title: string,
    description: string,
    state: RunState,
    screen: ScreenObservation
  ): Finding {
    return this.redactor.finding({
      id: sha1(`${category}:${title}:${screen.signature}`),
      severity,
      category,
      title,
      description,
      expected: "The app should remain usable and stable.",
      actual: description,
      stepsToReproduce: state.steps.slice(-8).map((step) => `${step.decision.action}: ${"reason" in step.decision ? step.decision.reason : ""}`),
      confidence: 0.7,
      firstSeenStep: state.currentStep,
      lastSeenStep: state.currentStep,
      screenSignature: screen.signature,
      screenshots: screen.screenshotPath ? [screen.screenshotPath] : [],
      logs: screen.logs
    });
  }

  private async finalize(state: RunState): Promise<void> {
    state.findings = dedupeFindings(state.findings);
    this.log(`Finalizing report with ${state.findings.length} finding(s).`);
    await this.store.saveState(state);
    await new FileReporter(state.runDir).finalizeReport(state);
  }

  private log(message: string): void {
    if (process.env.QAOSMONKEY_QUIET === "1") {
      return;
    }
    console.log(`[qaosmonkey] ${message}`);
  }
}

async function executeDeviceDecision(driver: DeviceDriver, decision: AgentDecision): Promise<void> {
  if (decision.action === "tap") return driver.tap(decision);
  if (decision.action === "type") return driver.type(decision);
  if (decision.action === "scroll") return driver.scroll(decision);
  if (decision.action === "swipe") return driver.swipe(decision);
  if (decision.action === "press_back") return driver.pressBack();
  if (decision.action === "dismiss_overlay") return driver.dismissOverlay();
  if (decision.action === "wait") return driver.wait(decision.milliseconds);
}

function detectCrash(logs: string): string | undefined {
  const crashLine = logs
    .split("\n")
    .reverse()
    .find((line) => /fatal exception|uncaught exception|segmentation fault|app crashed|ANR|crash/i.test(line));
  return crashLine;
}

function chooseFallbackExplorationAction(screen: ScreenObservation, steps: StepRecord[]): AgentDecision | undefined {
  const recentlyTargeted = new Set(
    steps
      .slice(-8)
      .map((step) => {
        const decision = step.decision;
        return "ref" in decision ? decision.ref : undefined;
      })
      .filter(Boolean)
  );
  const input = findRefByLine(screen.snapshot, recentlyTargeted, /\[(?:text-field|securetextfield|search)\]|(?:text-field|securetextfield|search)|editable/i);
  if (input) {
    return {
      action: "type",
      ref: input,
      value: "invalid-smoke-test-value",
      reason: "Model attempted to finish too early; probing an editable field instead."
    };
  }
  const target = findRefByLine(screen.snapshot, recentlyTargeted, /\[(?:button|cell|link|switch)\]|(?:button|cell|link|switch)/i);
  if (target) {
    return {
      action: "tap",
      ref: target,
      reason: "Model attempted to finish too early; exploring an available interactive element instead."
    };
  }
  if (screen.snapshot.includes("[scrollable]") || /\[(?:scroll-area|collection|table)\]/i.test(screen.snapshot)) {
    return {
      action: "scroll",
      direction: "down",
      reason: "Model attempted to finish too early; scrolling to look for more controls."
    };
  }
  return undefined;
}

function findRefByLine(snapshot: string, excludedRefs: Set<string | undefined>, pattern: RegExp): string | undefined {
  for (const line of snapshot.split("\n")) {
    const ref = line.match(/(@[a-zA-Z]?\d+)/)?.[1];
    if (!ref || excludedRefs.has(ref)) {
      continue;
    }
    if (pattern.test(line) && !/window|application|navigation-bar/i.test(line)) {
      return ref;
    }
  }
  return undefined;
}

function humanResultMessage(response: { kind: string; value?: string }): string {
  if (response.kind === "provided") return `Human provided input: ${response.value}`;
  if (response.kind === "resolved") return "Human resolved blocker on device.";
  if (response.kind === "skip") return "Human skipped blocker.";
  return `Human response: ${response.kind}`;
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `run-${timestamp}-${basename(process.cwd()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) || "qaosmonkey"}`;
}

function shortSignature(signature: string): string {
  return signature.slice(0, 8);
}

function summarizeDecision(decision: AgentDecision): string {
  if ("ref" in decision && decision.ref) {
    return `${decision.action} ${decision.ref}${"reason" in decision ? ` (${decision.reason})` : ""}`;
  }
  if (decision.action === "tap" && typeof decision.x === "number" && typeof decision.y === "number") {
    return `tap (${decision.x}, ${decision.y}) (${decision.reason})`;
  }
  if (decision.action === "wait") {
    return `wait ${decision.milliseconds}ms (${decision.reason})`;
  }
  if (decision.action === "log_bug") {
    return `log_bug ${decision.finding.severity}/${decision.finding.category}: ${decision.finding.title}`;
  }
  return `${decision.action}${"reason" in decision ? ` (${decision.reason})` : ""}`;
}
