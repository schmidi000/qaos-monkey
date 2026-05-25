import type { QAosMonkeyConfig } from "./src/types.ts";

const config: QAosMonkeyConfig = {
  app: {
    platform: "android",
    name: "Example App",
    packageName: "com.example.app",
    launchCommand: ["agent-device", "launch", "com.example.app"]
  },
  device: {
    driver: "agent-device",
    command: ["agent-device"],
    id: undefined,
    orientation: "portrait",
    resetBeforeRun: false
  },
  model: {
    provider: "codex-cli",
    command: ["codex", "exec", "--json", "--skip-git-repo-check"],
    model: "gpt-5",
    temperature: 0.4,
    maxContextMessages: 30,
    vision: true
  },
  credentials: {
    accounts: []
  },
  exploration: {
    goal: "Explore the app, discover screens, try edge cases, and report broken behavior.",
    persona: "You are an autonomous Chaos Monkey QA agent. Be curious, adversarial, and systematic.",
    maxSteps: 50,
    minimumStepsBeforeFinish: 8,
    timeLimitSeconds: 1800,
    destructiveLevel: "medium",
    maxRepeatedScreenVisits: 4,
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
