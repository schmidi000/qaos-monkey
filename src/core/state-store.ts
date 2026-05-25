import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { RunState, StepRecord } from "../types.ts";

export class StateStore {
  constructor(private rootDir: string) {}

  async createRun(state: RunState): Promise<void> {
    await mkdir(state.runDir, { recursive: true });
    await mkdir(join(state.runDir, "screenshots"), { recursive: true });
    await this.saveState(state);
    await this.appendEvent(state.id, { type: "run_started", at: state.startedAt, state });
  }

  async saveState(state: RunState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await mkdir(state.runDir, { recursive: true });
    await writeFile(join(state.runDir, "state.json"), JSON.stringify(state, null, 2), "utf8");
  }

  async appendStep(runId: string, step: StepRecord): Promise<void> {
    await this.appendEvent(runId, { type: "step", at: step.at, step });
  }

  async appendEvent(runId: string, event: unknown): Promise<void> {
    const runDir = this.runDir(runId);
    await mkdir(runDir, { recursive: true });
    await appendFile(join(runDir, "state.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  }

  async loadRun(runId: string): Promise<RunState> {
    const text = await readFile(join(this.runDir(runId), "state.json"), "utf8");
    return JSON.parse(text) as RunState;
  }

  runDir(runId: string): string {
    return resolve(this.rootDir, runId);
  }
}

