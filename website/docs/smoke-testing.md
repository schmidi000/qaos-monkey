---
id: smoke-testing
title: Smoke Testing Your App
---

# Smoke Testing Your App

Start with a short, low-risk run. Once the built-in iOS Settings smoke test works, point QAosMonkey at your app bundle or package id.

## iOS

Find your simulator UDID:

```bash
npx agent-device devices --platform ios --json
xcrun simctl list devices booted
```

Configure the driver:

```ts
const simulatorUdid = "YOUR_SIMULATOR_UDID";
const agentDevice = ["npx", "agent-device", "--platform", "ios", "--udid", simulatorUdid];
```

## Android

Find your emulator serial:

```bash
npx agent-device devices --platform android --json
adb devices
```

Configure the driver:

```ts
const emulatorSerial = "emulator-5554";
const agentDevice = ["npx", "agent-device", "--platform", "android", "--serial", emulatorSerial];
```

## Run

```bash
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

If you installed QAosMonkey from npm, use:

```bash
npx qaosmonkey run --config qaos-monkey.config.ts
```

Use `--` only with `npm run qaosmonkey -- ...`, not with `npx qaosmonkey`.

QAosMonkey prints `[qaosmonkey]` progress lines while it runs, including each step, screen observation, model call, chosen action, device execution, and result. CLI model providers also emit heartbeat messages every 10 seconds while QAosMonkey waits for Codex CLI or Claude Code to return a decision.

To silence progress logs:

```bash
QAOSMONKEY_QUIET=1 npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

Run artifacts are written to `.qaos-monkey/runs/<runId>/` by default. Each run directory contains:

- `report.md`: human-readable report.
- `report.json`: machine-readable report.
- `state.json`: latest persisted run state.
- `state.jsonl`: append-only per-step event trace for debugging.
- `screenshots/`: screenshots captured during the run.

You can change the artifact root with `reporting.outputDir`.

## When a Run Stops

QAosMonkey stops when the model returns `finish` after `minimumStepsBeforeFinish`, when `maxSteps` is reached, when `timeLimitSeconds` is reached, or when a human aborts a paused run.

The model is instructed to finish only after it has satisfied the goal and `mustTest` guidance, reached the step budget, or found no meaningful unexplored controls left. If it tries to finish before `minimumStepsBeforeFinish`, QAosMonkey ignores that early finish and performs a simple fallback exploratory action instead.
