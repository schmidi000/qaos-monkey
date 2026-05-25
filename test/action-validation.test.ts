import test from "node:test";
import assert from "node:assert/strict";
import { defaultConfig } from "../src/config.ts";
import { extractInteractiveRefs, findExcludedCurrentScreen, validateDecision } from "../src/core/action-validation.ts";

test("extractInteractiveRefs finds agent-device refs", () => {
  assert.deepEqual(extractInteractiveRefs('@e1 Button "Login"\n@e22 TextField "Email"'), ["@e1", "@e22"]);
});

test("validateDecision rejects missing tap target", () => {
  const errors = validateDecision(
    { action: "tap", ref: "@e9", reason: "missing" },
    { snapshot: '@e1 Button "Login"', logs: "", signature: "abc", interactiveRefs: ["@e1"] },
    defaultConfig
  );
  assert.match(errors.join("\n"), /not present/);
});

test("validateDecision honors excluded actions", () => {
  const config = {
    ...defaultConfig,
    exploration: { ...defaultConfig.exploration, excludedActions: ["tap"] }
  };
  const errors = validateDecision(
    { action: "tap", ref: "@e1", reason: "blocked" },
    { snapshot: '@e1 Button "Login"', logs: "", signature: "abc", interactiveRefs: ["@e1"] },
    config
  );
  assert.match(errors.join("\n"), /excluded/);
});

test("excludedScreens does not block a screen only because it contains a matching link", () => {
  const config = {
    ...defaultConfig,
    exploration: { ...defaultConfig.exploration, excludedScreens: ["Forgot password"] }
  };
  const screen = {
    snapshot: [
      '@e1 StaticText "Login"',
      '@e2 TextField "Email"',
      '@e3 SecureTextField "Password"',
      '@e4 Button "Sign in"',
      '@e5 Link "Forgot password"'
    ].join("\n"),
    logs: "",
    signature: "login",
    interactiveRefs: ["@e1", "@e2", "@e3", "@e4", "@e5"]
  };

  assert.equal(findExcludedCurrentScreen(screen.snapshot, config.exploration.excludedScreens), undefined);
  assert.deepEqual(validateDecision({ action: "tap", ref: "@e4", reason: "sign in" }, screen, config), []);
});

test("excludedScreens blocks tapping a matching navigation target", () => {
  const config = {
    ...defaultConfig,
    exploration: { ...defaultConfig.exploration, excludedScreens: ["Forgot password"] }
  };
  const errors = validateDecision(
    { action: "tap", ref: "@e5", reason: "open reset flow" },
    {
      snapshot: [
        '@e1 StaticText "Login"',
        '@e4 Button "Sign in"',
        '@e5 Link "Forgot password"'
      ].join("\n"),
      logs: "",
      signature: "login",
      interactiveRefs: ["@e1", "@e4", "@e5"]
    },
    config
  );

  assert.match(errors.join("\n"), /Action target matches excluded screen pattern/);
});

test("excludedScreens treats title-like text as the current excluded screen", () => {
  const config = {
    ...defaultConfig,
    exploration: { ...defaultConfig.exploration, excludedScreens: ["Forgot password"] }
  };
  const screen = {
    snapshot: [
      '@e1 StaticText "Forgot password"',
      '@e2 TextField "Email"',
      '@e3 Button "Send reset link"'
    ].join("\n"),
    logs: "",
    signature: "forgot",
    interactiveRefs: ["@e1", "@e2", "@e3"]
  };

  assert.equal(findExcludedCurrentScreen(screen.snapshot, config.exploration.excludedScreens), "Forgot password");
  assert.match(
    validateDecision({ action: "type", ref: "@e2", value: "user@example.test", reason: "try reset" }, screen, config).join("\n"),
    /Current screen title\/header matches excluded screen pattern/
  );
  assert.deepEqual(validateDecision({ action: "press_back", reason: "leave excluded screen" }, screen, config), []);
});
