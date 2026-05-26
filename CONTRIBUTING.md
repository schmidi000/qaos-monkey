# Contributing to QAosMonkey

Thanks for helping improve QAosMonkey. Contributions are welcome across bug reports, documentation, device-driver adapters, model-provider adapters, prompt improvements, and reproducible mobile testing scenarios.

## License Disclaimer

By contributing to QAosMonkey, you agree that your contributions will be licensed under the same license as the project. QAosMonkey currently uses the MIT No Attribution license (`MIT-0`). Only contribute code, docs, images, or other assets that you have the right to submit under this license.

## How can I contribute?

### Reporting Bugs

Use the bug report issue template and include as much runtime context as possible. Mobile automation failures are often environment-specific, so please include:

- the exact command you ran.
- your OS and CPU architecture.
- iOS Simulator or Android Emulator version.
- app platform and build type.
- model provider and model name.
- `agent-device` or Maestro version.
- relevant `.qaos-monkey/runs/<runId>/state.jsonl` lines.
- screenshots when the model made a bad visual decision.

Please redact secrets, tokens, OTPs, emails, and private app data before posting logs.

### Suggesting Enhancements

Use the feature request issue template for new ideas. Good enhancement requests usually include:

- the testing workflow you are trying to support.
- what the agent currently does.
- what you expected it to do instead.
- whether this should be a core feature, config option, driver adapter, model adapter, or prompt improvement.
- examples from real mobile apps when possible.

### Local Development Setup

Clone the repo and install dependencies:

```bash
git clone https://github.com/schmidi000/qaos-monkey.git
cd qaos-monkey
npm install
```

Run tests:

```bash
npm test
```

Build the npm package output:

```bash
npm run build
```

Run the CLI from source:

```bash
npm run qaosmonkey -- --help
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

For website changes:

```bash
cd website
npm install
npm run start
```

## Pull Request Process

1. Open an issue first for large behavior changes, new adapters, or changes to exploration strategy.
2. Keep pull requests focused. Separate docs, refactors, and behavior changes when practical.
3. Add or update tests for runner behavior, action validation, config loading, provider parsing, reporting, or credential redaction.
4. Run `npm test` before opening the PR.
5. Run `npm run build` if package output or TypeScript types changed.
6. For website changes, run `npm run build` inside `website/`.
7. Document user-facing changes in `README.md` or `website/docs/`.
8. Do not include secrets, private configs, generated run artifacts, simulator logs, screenshots with private data, or `.env` files.
