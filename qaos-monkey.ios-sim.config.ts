import type { QAosMonkeyConfig } from "./src/types.ts";

const simulatorUdid = "83E1501B-FFFD-4ACE-87D2-B80B8247D272";
const agentDevice = ["npx", "agent-device", "--platform", "ios", "--udid", simulatorUdid];

const config: QAosMonkeyConfig = {
  app: {
    platform: "ios",
    name: "iOS Settings Smoke",
    bundleId: "com.apple.Preferences",
    launchCommand: [...agentDevice, "open", "Settings"]
  },
  device: {
    driver: "agent-device",
    command: agentDevice,
    id: simulatorUdid,
    orientation: "portrait",
    resetBeforeRun: false
  },
  model: {
    provider: "codex-cli",
    command: ["node", "test/fixtures/ios-smoke-model.mjs"],
    model: "deterministic-smoke",
    temperature: 0,
    maxContextMessages: 5,
    vision: false
  },
  credentials: {
    accounts: []
  },
  exploration: {
    goal: "Smoke-test QAosMonkey against the already-running iOS simulator by opening Settings and tapping General.",
    persona: "You are a deterministic smoke-test model.",
    maxSteps: 2,
    minimumStepsBeforeFinish: 0,
    timeLimitSeconds: 120,
    destructiveLevel: "low",
    maxRepeatedScreenVisits: 3,
    excludedActions: [],
    excludedScreens: [],
    allowlistRiskyAreas: []
  },
  humanInput: {
    provider: "cli"
  },
  reporting: {
    outputDir: ".qaos-monkey/runs",
    retainScreenshots: true
  }
};

export default config;
