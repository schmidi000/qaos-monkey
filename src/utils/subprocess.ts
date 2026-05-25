import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface CommandRunOptions {
  timeoutMs?: number;
  onStdoutData?: (chunk: string) => void;
  onStderrData?: (chunk: string) => void;
  onHeartbeat?: (elapsedMs: number) => void;
  heartbeatMs?: number;
}

export function runCommand(command: string[], input?: string, timeoutMsOrOptions: number | CommandRunOptions = 120000): Promise<CommandResult> {
  if (command.length === 0) {
    throw new Error("Cannot run an empty command.");
  }
  const options = typeof timeoutMsOrOptions === "number" ? { timeoutMs: timeoutMsOrOptions } : timeoutMsOrOptions;
  const timeoutMs = options.timeoutMs ?? 120000;
  return new Promise((resolve, reject) => {
    const resolvedCommand = resolveKnownExecutable(command[0]);
    const startedAt = Date.now();
    let settled = false;
    const child = spawn(resolvedCommand, command.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });
    let stdout = "";
    let stderr = "";
    const heartbeat = options.onHeartbeat
      ? setInterval(() => {
          if (!settled) {
            options.onHeartbeat?.(Date.now() - startedAt);
          }
        }, options.heartbeatMs ?? 10000)
      : undefined;
    const timer = setTimeout(() => {
      settled = true;
      if (heartbeat) clearInterval(heartbeat);
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command.join(" ")}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      options.onStdoutData?.(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      options.onStderrData?.(chunk);
    });
    child.on("error", (error) => {
      settled = true;
      clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      reject(commandError(error, command));
    });
    child.on("close", (code) => {
      settled = true;
      clearTimeout(timer);
      if (heartbeat) clearInterval(heartbeat);
      resolve({ stdout, stderr, code });
    });
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

export async function runCommandOrThrow(command: string[], input?: string, timeoutMs?: number): Promise<string> {
  const result = await runCommand(command, input, timeoutMs);
  if (result.code !== 0) {
    throw new Error(`Command failed (${result.code}): ${command.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

export async function runCommandOrThrowWithOptions(command: string[], input?: string, options?: CommandRunOptions): Promise<string> {
  const result = await runCommand(command, input, options);
  if (result.code !== 0) {
    throw new Error(`Command failed (${result.code}): ${command.join(" ")}\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function resolveKnownExecutable(executable: string): string {
  if (executable.includes("/") || executable !== "codex") {
    return executable;
  }
  const macCodexPath = "/Applications/Codex.app/Contents/Resources/codex";
  try {
    accessSync(macCodexPath, constants.X_OK);
    return macCodexPath;
  } catch {
    return executable;
  }
}

function commandError(error: Error & { code?: string }, command: string[]): Error {
  if (error.code !== "ENOENT") {
    return error;
  }
  const executable = command[0];
  const hint = executable === "codex"
    ? "Codex was not found on PATH. Install the Codex CLI, add it to PATH, or set model.command to the full executable path, for example [\"/Applications/Codex.app/Contents/Resources/codex\", \"exec\", \"--json\", \"--skip-git-repo-check\"] on macOS."
    : `Executable ${JSON.stringify(executable)} was not found on PATH. Install it, add it to PATH, or set the config command to its full executable path.`;
  return new Error(`Failed to spawn command: ${command.join(" ")}\n${hint}`);
}
