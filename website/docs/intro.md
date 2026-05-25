---
id: intro
title: Introduction
slug: /intro
---

# QAosMonkey

QAosMonkey is a tech-agnostic exploratory mobile testing agent for iOS and Android emulators. It drives your app through `agent-device`, asks a configurable model what to try next, pauses for human help when needed, and writes reports with screenshots and reproducible traces.

## What It Does

- Explores native, React Native, Flutter, and webview-heavy mobile apps through the simulator or emulator accessibility layer.
- Lets a model choose actions such as tapping, typing, scrolling, dismissing React Native overlays, and logging bugs.
- Supports human-in-the-loop pauses for OTPs, captchas, email links, credentials, and ambiguous app-specific data.
- Supports redacted test credentials from environment variables or CI/CD secret stores.
- Produces Markdown and JSON reports under `.qaos-monkey/runs`.

## Quick Start

```bash
npm run qaosmonkey -- init
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

For a deterministic simulator smoke test, use:

```bash
npm run qaosmonkey -- run --config qaos-monkey.ios-sim.config.ts
```

## Requirements

- Node.js 22.6 or newer for the current TypeScript runtime.
- A booted iOS simulator or running Android emulator.
- `agent-device`, available globally or through `npx`.
- A model provider such as Codex CLI, Claude Code, OpenAI-compatible APIs, or Anthropic.

