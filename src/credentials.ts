import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AgentDecision, Finding, QAosMonkeyConfig, RuntimeCredential, StepRecord } from "./types.ts";

export async function loadCredentialEnvFile(config: QAosMonkeyConfig, configPath: string): Promise<void> {
  const envFile = config.credentials?.envFile;
  if (!envFile || (config.credentials?.accounts.length ?? 0) === 0) {
    return;
  }
  const absolutePath = resolve(dirname(resolve(configPath)), envFile);
  let text: string;
  try {
    text = await readFile(absolutePath, "utf8");
  } catch (error) {
    if (credentialEnvVars(config).every((key) => process.env[key] !== undefined)) {
      return;
    }
    throw new Error(`Unable to read credentials envFile ${envFile}: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const [key, value] of parseEnvFile(text)) {
    process.env[key] ??= value;
  }
}

function credentialEnvVars(config: QAosMonkeyConfig): string[] {
  return (config.credentials?.accounts ?? []).flatMap((account) =>
    Object.values(account.fields).map((field) => field.env)
  );
}

export function resolveCredentials(config: QAosMonkeyConfig): RuntimeCredential[] {
  return (config.credentials?.accounts ?? []).map((account) => {
    const fields = Object.entries(account.fields).map(([key, field]) => {
      const value = process.env[field.env];
      if (value === undefined) {
        throw new Error(`Missing credential environment variable ${field.env} for credentials.${account.id}.${key}`);
      }
      return {
        key,
        label: field.label ?? key,
        env: field.env,
        value,
        sensitive: field.sensitive ?? true
      };
    });
    return {
      id: account.id,
      description: account.description,
      fields
    };
  });
}

export class SecretRedactor {
  private secrets: string[];

  constructor(credentials: RuntimeCredential[]) {
    this.secrets = credentials
      .flatMap((credential) => credential.fields)
      .filter((field) => field.sensitive && field.value.length > 0)
      .map((field) => field.value);
  }

  text(value: string): string {
    let redacted = value;
    for (const secret of this.secrets) {
      redacted = redacted.split(secret).join("[REDACTED]");
    }
    return redacted;
  }

  decision(decision: AgentDecision): AgentDecision {
    return this.object(decision);
  }

  finding(finding: Finding): Finding {
    return this.object(finding);
  }

  step(step: StepRecord): StepRecord {
    return this.object(step);
  }

  object<T>(value: T): T {
    if (this.secrets.length === 0) {
      return value;
    }
    return JSON.parse(this.text(JSON.stringify(value))) as T;
  }
}

function parseEnvFile(text: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const equals = trimmed.indexOf("=");
    if (equals === -1) {
      continue;
    }
    const key = trimmed.slice(0, equals).trim();
    const rawValue = trimmed.slice(equals + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    entries.push([key, unquote(rawValue)]);
  }
  return entries;
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return value;
}
