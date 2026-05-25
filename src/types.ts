export type Platform = "ios" | "android";
export type DeviceDriverName = "agent-device" | "maestro";
export type ModelProviderName = "openai-compatible" | "anthropic" | "codex-cli" | "claude-code";
export type DestructiveLevel = "low" | "medium" | "high";
export type RunStatus = "running" | "paused" | "finished" | "aborted" | "failed";
export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingCategory = "crash" | "visual" | "functional" | "performance" | "accessibility" | "blocker" | "unknown";

export interface QAosMonkeyConfig {
  app: {
    platform: Platform;
    name?: string;
    bundleId?: string;
    packageName?: string;
    launchCommand?: string[];
    installCommand?: string[];
  };
  device: {
    driver: DeviceDriverName;
    command?: string[];
    id?: string;
    orientation?: "portrait" | "landscape";
    resetBeforeRun?: boolean;
    commandMap?: Partial<Record<DeviceActionName | "snapshot" | "screenshot" | "logs" | "launch", string[]>>;
  };
  model: {
    provider: ModelProviderName;
    model?: string;
    baseUrl?: string;
    apiKeyEnv?: string;
    command?: string[];
    temperature?: number;
    maxContextMessages?: number;
    vision?: boolean;
  };
  credentials?: {
    envFile?: string;
    accounts: CredentialDefinition[];
  };
  exploration: {
    goal: string;
    persona: string;
    mustTest?: string[];
    maxSteps: number;
    minimumStepsBeforeFinish?: number;
    timeLimitSeconds: number;
    destructiveLevel: DestructiveLevel;
    maxRepeatedScreenVisits: number;
    excludedActions: string[];
    excludedScreens: string[];
    allowlistRiskyAreas: string[];
  };
  humanInput: {
    provider: "cli";
  };
  reporting: {
    outputDir: string;
    retainScreenshots: boolean;
  };
}

export interface CredentialDefinition {
  id: string;
  description: string;
  fields: Record<string, CredentialFieldDefinition>;
}

export interface CredentialFieldDefinition {
  env: string;
  label?: string;
  sensitive?: boolean;
}

export interface RuntimeCredential {
  id: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    env: string;
    value: string;
    sensitive: boolean;
  }>;
}

export type DeviceActionName = "tap" | "type" | "scroll" | "swipe" | "press_back" | "dismiss_overlay" | "wait";

export type AgentDecision =
  | { action: "tap"; ref?: string; x?: number; y?: number; reason: string }
  | { action: "type"; ref?: string; value: string; submit?: boolean; reason: string }
  | { action: "scroll"; direction: "up" | "down" | "left" | "right"; ref?: string; reason: string }
  | { action: "swipe"; direction: "up" | "down" | "left" | "right"; ref?: string; reason: string }
  | { action: "press_back"; reason: string }
  | { action: "dismiss_overlay"; reason: string }
  | { action: "wait"; milliseconds: number; reason: string }
  | { action: "ask_human"; reason: string; options?: string[] }
  | { action: "log_bug"; finding: Omit<Finding, "id" | "firstSeenStep" | "lastSeenStep" | "screenshots">; reason: string }
  | { action: "finish"; reason: string };

export interface DecisionContext {
  runId: string;
  stepIndex: number;
  goal: string;
  persona: string;
  mustTest: string[];
  destructiveLevel: DestructiveLevel;
  currentScreen: ScreenObservation;
  recentSteps: StepRecord[];
  credentials: RuntimeCredential[];
  screenGraph: ScreenGraphSnapshot;
  guardrails: {
    maxSteps: number;
    excludedActions: string[];
    excludedScreens: string[];
    allowlistRiskyAreas: string[];
  };
}

export interface ScreenObservation {
  snapshot: string;
  screenshotPath?: string;
  logs: string;
  signature: string;
  interactiveRefs: string[];
}

export interface StepRecord {
  index: number;
  at: string;
  screenSignature: string;
  decision: AgentDecision;
  result: ActionResult;
}

export interface ActionResult {
  status: "progress" | "no-op" | "blocker" | "crash" | "visual-issue" | "bug" | "skipped" | "failed" | "finished";
  message: string;
  beforeSignature?: string;
  afterSignature?: string;
  error?: string;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  expected?: string;
  actual?: string;
  stepsToReproduce: string[];
  confidence: number;
  firstSeenStep: number;
  lastSeenStep: number;
  screenSignature?: string;
  screenshots: string[];
  logs?: string;
}

export interface ScreenGraphSnapshot {
  nodes: Array<{ signature: string; visits: number; sample: string }>;
  edges: Array<{ from: string; to: string; action: string; count: number }>;
}

export interface RunState {
  id: string;
  startedAt: string;
  updatedAt: string;
  status: RunStatus;
  currentStep: number;
  configPath: string;
  runDir: string;
  steps: StepRecord[];
  findings: Finding[];
  screenGraph: ScreenGraphSnapshot;
  pendingHumanRequest?: {
    reason: string;
    options: string[];
    screen?: ScreenObservation;
  };
}

export interface DeviceDriver {
  snapshot(): Promise<string>;
  tap(input: { ref?: string; x?: number; y?: number }): Promise<void>;
  type(input: { ref?: string; value: string; submit?: boolean }): Promise<void>;
  scroll(input: { direction: "up" | "down" | "left" | "right"; ref?: string }): Promise<void>;
  swipe(input: { direction: "up" | "down" | "left" | "right"; ref?: string }): Promise<void>;
  pressBack(): Promise<void>;
  dismissOverlay(): Promise<void>;
  wait(milliseconds: number): Promise<void>;
  launchApp(): Promise<void>;
  getLogs(): Promise<string>;
  screenshot(outputPath: string): Promise<string | undefined>;
}

export interface ModelProvider {
  decideNextAction(context: DecisionContext): Promise<AgentDecision>;
}

export interface HumanInputProvider {
  requestHelp(reason: string, screen?: ScreenObservation, options?: string[]): Promise<HumanInputResult>;
}

export type HumanInputResult =
  | { kind: "provided"; value: string }
  | { kind: "resolved" }
  | { kind: "skip" }
  | { kind: "abort" };

export interface Reporter {
  recordStep(step: StepRecord): Promise<void>;
  recordFinding(finding: Finding): Promise<void>;
  finalizeReport(state: RunState): Promise<void>;
}
