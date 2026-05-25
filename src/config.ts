import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { QAosMonkeyConfig } from "./types.ts";
import { loadCredentialEnvFile } from "./credentials.ts";

export const defaultConfig: QAosMonkeyConfig = {
  app: {
    platform: "android",
    name: "My App"
  },
  device: {
    driver: "agent-device",
    command: ["agent-device"],
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
    mustTest: [],
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

export async function loadConfig(configPath: string): Promise<QAosMonkeyConfig> {
  const absolutePath = resolve(configPath);
  const module = await import(`${pathToFileURL(absolutePath).href}?t=${Date.now()}`);
  const loaded = module.default ?? module.config;
  if (!loaded || typeof loaded !== "object") {
    throw new Error(`Config file ${configPath} must export a default QAosMonkeyConfig object.`);
  }
  const config = mergeConfig(defaultConfig, loaded as Partial<QAosMonkeyConfig>);
  await loadCredentialEnvFile(config, absolutePath);
  return config;
}

export function mergeConfig(base: QAosMonkeyConfig, override: Partial<QAosMonkeyConfig>): QAosMonkeyConfig {
  return {
    ...base,
    ...override,
    app: { ...base.app, ...override.app },
    device: { ...base.device, ...override.device },
    model: { ...base.model, ...override.model },
    credentials: {
      ...base.credentials,
      ...override.credentials,
      accounts: override.credentials?.accounts ?? base.credentials?.accounts ?? []
    },
    exploration: { ...base.exploration, ...override.exploration },
    humanInput: { ...base.humanInput, ...override.humanInput },
    reporting: { ...base.reporting, ...override.reporting }
  };
}

export async function createConfigFile(targetPath = "qaos-monkey.config.ts"): Promise<string> {
  const absoluteTarget = resolve(targetPath);
  try {
    await access(absoluteTarget);
    return absoluteTarget;
  } catch {
    await mkdir(dirname(absoluteTarget), { recursive: true });
    try {
      await copyFile(exampleConfigPath(), absoluteTarget);
    } catch {
      await writeFile(absoluteTarget, defaultConfigText(), "utf8");
    }
    return absoluteTarget;
  }
}

function exampleConfigPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "qaos-monkey.config.example.ts");
}

function defaultConfigText(): string {
  return `const config = ${JSON.stringify(defaultConfig, null, 2)};

export default config;
`;
}
