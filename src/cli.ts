#!/usr/bin/env -S node --experimental-transform-types
import { resolve } from "node:path";
import { createConfigFile, loadConfig } from "./config.ts";
import { createDeviceDriver } from "./drivers/index.ts";
import { CliHumanInputProvider } from "./human/cli.ts";
import { createModelProvider } from "./models/index.ts";
import { FileReporter } from "./reporting/reporter.ts";
import { Runner } from "./core/runner.ts";
import { StateStore } from "./core/state-store.ts";

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }
  if (command === "init") {
    const target = valueAfter(rest, "--config") ?? "qaos-monkey.config.ts";
    const path = await createConfigFile(target);
    console.log(`Created ${path}`);
    return;
  }
  if (command === "run") {
    const configPath = valueAfter(rest, "--config") ?? "qaos-monkey.config.ts";
    const config = await loadConfig(configPath);
    const runner = new Runner({
      config,
      configPath: resolve(configPath),
      driver: createDeviceDriver(config),
      model: createModelProvider(config),
      human: new CliHumanInputProvider()
    });
    const state = await runner.start();
    console.log(`Run ${state.id} ended with status ${state.status}`);
    console.log(`Artifacts: ${state.runDir}`);
    return;
  }
  if (command === "resume") {
    const runId = rest[0];
    if (!runId) throw new Error("resume requires a runId.");
    const configPath = valueAfter(rest, "--config") ?? "qaos-monkey.config.ts";
    const config = await loadConfig(configPath);
    const runner = new Runner({
      config,
      configPath: resolve(configPath),
      driver: createDeviceDriver(config),
      model: createModelProvider(config),
      human: new CliHumanInputProvider()
    });
    const state = await runner.resume(runId);
    console.log(`Run ${state.id} ended with status ${state.status}`);
    console.log(`Artifacts: ${state.runDir}`);
    return;
  }
  if (command === "report") {
    const runId = rest[0];
    if (!runId) throw new Error("report requires a runId.");
    const configPath = valueAfter(rest, "--config") ?? "qaos-monkey.config.ts";
    const config = await loadConfig(configPath);
    const store = new StateStore(config.reporting.outputDir);
    const state = await store.loadRun(runId);
    await new FileReporter(state.runDir).finalizeReport(state);
    console.log(`Report written to ${state.runDir}`);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

function valueAfter(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function printHelp(): void {
  console.log(`QAosMonkey

Usage:
  qaosmonkey init [--config qaos-monkey.config.ts]
  qaosmonkey run --config qaos-monkey.config.ts
  qaosmonkey resume <runId> [--config qaos-monkey.config.ts]
  qaosmonkey report <runId> [--config qaos-monkey.config.ts]

Environment:
  QAOSMONKEY_QUIET=1  Disable progress logging.
`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
