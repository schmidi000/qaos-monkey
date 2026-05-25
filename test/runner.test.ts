import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../src/config.ts";
import { Runner } from "../src/core/runner.ts";
import type { AgentDecision, QAosMonkeyConfig, DecisionContext, DeviceDriver, HumanInputProvider, ModelProvider } from "../src/types.ts";

class MockDriver implements DeviceDriver {
  snapshots = ['@e1 Button "Login"', '@e2 TextField "Email"', '@e3 Text "Home"'];
  index = 0;
  async snapshot() { return this.snapshots[Math.min(this.index, this.snapshots.length - 1)]; }
  async tap() { this.index += 1; }
  async type() { this.index += 1; }
  async scroll() {}
  async swipe() {}
  async pressBack() { this.index = Math.max(0, this.index - 1); }
  async dismissOverlay() {}
  async wait() {}
  async launchApp() {}
  async getLogs() { return ""; }
  async screenshot(outputPath: string) { return outputPath; }
}

class ScriptedModel implements ModelProvider {
  constructor(private decisions: AgentDecision[]) {}
  async decideNextAction(_context: DecisionContext) {
    return this.decisions.shift() ?? { action: "finish", reason: "done" };
  }
}

class ResolvedHuman implements HumanInputProvider {
  async requestHelp() {
    return { kind: "resolved" as const };
  }
}

test("Runner explores, handles human blocker, and finalizes report", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-test-"));
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    reporting: { outputDir: root, retainScreenshots: false },
    exploration: { ...defaultConfig.exploration, maxSteps: 5, timeLimitSeconds: 30 }
  };
  const runner = new Runner({
    config,
    configPath: "test-config.ts",
    driver: new MockDriver(),
    human: new ResolvedHuman(),
    model: new ScriptedModel([
      { action: "tap", ref: "@e1", reason: "open login" },
      { action: "ask_human", reason: "Need test credentials" },
      { action: "type", ref: "@e2", value: "bad@example.com", reason: "try invalid login" },
      { action: "finish", reason: "done" }
    ])
  });
  const state = await runner.start();
  assert.equal(state.status, "finished");
  assert.ok(state.steps.length >= 4);
  assert.ok(state.runDir.startsWith(root));
  await rm(root, { recursive: true, force: true });
});

test("Runner does not accept finish before minimumStepsBeforeFinish", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-test-"));
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    reporting: { outputDir: root, retainScreenshots: false },
    exploration: { ...defaultConfig.exploration, maxSteps: 3, minimumStepsBeforeFinish: 2, timeLimitSeconds: 30 }
  };
  const runner = new Runner({
    config,
    configPath: "test-config.ts",
    driver: new MockDriver(),
    human: new ResolvedHuman(),
    model: new ScriptedModel([
      { action: "finish", reason: "too early" },
      { action: "finish", reason: "still too early" },
      { action: "finish", reason: "minimum reached" }
    ])
  });
  const state = await runner.start();
  assert.equal(state.status, "finished");
  assert.equal(state.steps[0].decision.action, "tap");
  assert.match(state.steps[0].decision.reason, /finish too early/);
  assert.notEqual(state.steps[1].decision.action, "finish");
  assert.equal(state.steps[2].decision.action, "finish");
  await rm(root, { recursive: true, force: true });
});

test("Runner provides credentials to the model and redacts them from state", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-test-"));
  process.env.QAOSMONKEY_TEST_EMAIL = "admin@example.test";
  process.env.QAOSMONKEY_TEST_PASSWORD = "super-secret-password";
  class CredentialAwareModel implements ModelProvider {
    async decideNextAction(context: DecisionContext) {
      const password = context.credentials[0]?.fields.find((field) => field.key === "password")?.value;
      assert.equal(password, "super-secret-password");
      return { action: "type" as const, ref: "@e1", value: password, reason: `typing ${password}` };
    }
  }
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    credentials: {
      accounts: [
        {
          id: "admin",
          description: "Admin user for smoke testing.",
          fields: {
            email: { env: "QAOSMONKEY_TEST_EMAIL", label: "Email" },
            password: { env: "QAOSMONKEY_TEST_PASSWORD", label: "Password" }
          }
        }
      ]
    },
    reporting: { outputDir: root, retainScreenshots: false },
    exploration: { ...defaultConfig.exploration, maxSteps: 1, minimumStepsBeforeFinish: 0, timeLimitSeconds: 30 }
  };
  const runner = new Runner({
    config,
    configPath: "test-config.ts",
    driver: new MockDriver(),
    human: new ResolvedHuman(),
    model: new CredentialAwareModel()
  });
  const state = await runner.start();
  assert.equal(state.steps[0].decision.action, "type");
  assert.equal(state.steps[0].decision.value, "[REDACTED]");
  assert.match(state.steps[0].decision.reason, /\[REDACTED\]/);
  assert.doesNotMatch(JSON.stringify(state), /super-secret-password/);
  await rm(root, { recursive: true, force: true });
});

test("Runner passes mustTest guidance to the model context", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-test-"));
  const mustTest = [
    "Login must work.",
    "After creating a post, it should be immediately visible."
  ];
  class MustTestAwareModel implements ModelProvider {
    async decideNextAction(context: DecisionContext) {
      assert.deepEqual(context.mustTest, mustTest);
      return { action: "finish" as const, reason: "verified mustTest context" };
    }
  }
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    reporting: { outputDir: root, retainScreenshots: false },
    exploration: {
      ...defaultConfig.exploration,
      mustTest,
      maxSteps: 1,
      minimumStepsBeforeFinish: 0,
      timeLimitSeconds: 30
    }
  };
  const runner = new Runner({
    config,
    configPath: "test-config.ts",
    driver: new MockDriver(),
    human: new ResolvedHuman(),
    model: new MustTestAwareModel()
  });
  const state = await runner.start();
  assert.equal(state.status, "finished");
  await rm(root, { recursive: true, force: true });
});
