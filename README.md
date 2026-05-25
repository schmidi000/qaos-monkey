# QAosMonkey

QAosMonkey is a tech-agnostic exploratory mobile testing agent. It drives iOS and Android emulators through `agent-device`, asks a configurable model what to try next, pauses when human help is required, and writes reproducible bug reports with screenshots and step traces.

Website: [qaosmonkey.com](https://qaosmonkey.com)

The current implementation is a working scaffold: it can already control an iOS simulator, collect accessibility snapshots, execute model decisions, persist run state, and generate reports. The default project runs TypeScript directly with Node 22's built-in type transform, so the first version does not require a build step.

## Requirements

- Node.js 22.6 or newer.
- For iOS: Xcode with a booted iOS Simulator.
- For Android: a running Android emulator.
- `agent-device`, either installed globally or run through `npx`.
- One model provider:
  - a CLI command such as Codex CLI or Claude Code that reads a prompt from stdin and prints one JSON decision, or
  - an OpenAI-compatible or Anthropic API key.

Useful sanity checks:

```bash
node --version
npx agent-device --help
npx agent-device devices --platform ios --json
```

## Find Your Simulator or Emulator Id

QAosMonkey needs a stable device identifier so `agent-device` controls the simulator/emulator you intend.

### iOS Simulator UDID

With an iOS simulator already booted, use either command:

```bash
npx agent-device devices --platform ios --json
xcrun simctl list devices booted
```

Look for the booted simulator entry. The UDID is the long UUID-like value.

Example:

```text
iPhone 16 Pro Max (83E1501B-FFFD-4ACE-87D2-B80B8247D272) (Booted)
```

Use that value in config:

```ts
const simulatorUdid = "83E1501B-FFFD-4ACE-87D2-B80B8247D272";

device: {
  command: ["npx", "agent-device", "--platform", "ios", "--udid", simulatorUdid],
  id: simulatorUdid
}
```

### Android Emulator Serial

With an Android emulator already running, use either command:

```bash
npx agent-device devices --platform android --json
adb devices
```

Look for the running emulator serial. It usually looks like `emulator-5554`.

Example:

```text
emulator-5554	device
```

Use that value in config:

```ts
const emulatorSerial = "emulator-5554";

device: {
  command: ["npx", "agent-device", "--platform", "android", "--serial", emulatorSerial],
  id: emulatorSerial
}
```

## First Verify QAosMonkey Works

Before pointing QAosMonkey at your own app, run the included iOS simulator smoke test. This does not need an LLM. It uses a deterministic local model fixture, opens iOS Settings, taps General, captures screenshots, and writes a report.

1. Boot an iOS simulator.

```bash
xcrun simctl list devices booted
```

2. Update the simulator UDID in [qaos-monkey.ios-sim.config.ts](qaos-monkey.ios-sim.config.ts) if it differs from your booted simulator.

```ts
const simulatorUdid = "YOUR_BOOTED_SIMULATOR_UDID";
```

3. Run the smoke test.

```bash
npm run qaosmonkey -- run --config qaos-monkey.ios-sim.config.ts
```

4. Open the generated report.

```bash
ls .qaos-monkey/runs
cat .qaos-monkey/runs/<runId>/report.md
```

A successful run should show `Status: finished`, two visited screens, screenshots under `screenshots/`, and a trace containing `tap` then `finish`.

## Smoke Test Your App

Use this path once the built-in Settings smoke test works.

1. Create your config.

```bash
npm run qaosmonkey -- init
```

This creates [qaos-monkey.config.ts](qaos-monkey.config.ts). Edit it for your app.

2. Set the platform and app id.

For iOS:

```ts
app: {
  platform: "ios",
  name: "My iOS App",
  bundleId: "com.yourcompany.yourapp",
  launchCommand: ["npx", "agent-device", "--platform", "ios", "--udid", "YOUR_SIMULATOR_UDID", "open", "com.yourcompany.yourapp"]
}
```

For Android:

```ts
app: {
  platform: "android",
  name: "My Android App",
  packageName: "com.yourcompany.yourapp",
  launchCommand: ["npx", "agent-device", "--platform", "android", "--serial", "YOUR_EMULATOR_SERIAL", "open", "com.yourcompany.yourapp"]
}
```

3. Configure the device driver.

For iOS:

```ts
device: {
  driver: "agent-device",
  command: ["npx", "agent-device", "--platform", "ios", "--udid", "YOUR_SIMULATOR_UDID"],
  id: "YOUR_SIMULATOR_UDID",
  orientation: "portrait",
  resetBeforeRun: false
}
```

For Android:

```ts
device: {
  driver: "agent-device",
  command: ["npx", "agent-device", "--platform", "android", "--serial", "YOUR_EMULATOR_SERIAL"],
  id: "YOUR_EMULATOR_SERIAL",
  orientation: "portrait",
  resetBeforeRun: false
}
```

Find ids with:

```bash
npx agent-device devices --platform ios --json
npx agent-device devices --platform android --json
```

4. Configure the model.

For a CLI provider, the command must read the full QAosMonkey prompt from stdin and print exactly one JSON action to stdout.

```ts
model: {
  provider: "codex-cli",
  command: ["codex", "exec", "--json", "--skip-git-repo-check"],
  model: "gpt-5",
  temperature: 0.4,
  maxContextMessages: 30,
  vision: true
}
```

If you see `spawn codex ENOENT`, the `codex` executable is not on the PATH visible to QAosMonkey. On macOS with the Codex desktop app, use the full executable path:

```ts
model: {
  provider: "codex-cli",
  command: ["/Applications/Codex.app/Contents/Resources/codex", "exec", "--json", "--skip-git-repo-check"],
  model: "gpt-5",
  temperature: 0.4,
  maxContextMessages: 30,
  vision: true
}
```

You can check what your shell sees with:

```bash
which codex
```

For an OpenAI-compatible API:

```ts
model: {
  provider: "openai-compatible",
  model: "gpt-4o",
  apiKeyEnv: "OPENAI_API_KEY",
  vision: true
}
```

For Anthropic:

```ts
model: {
  provider: "anthropic",
  model: "claude-3-5-sonnet-latest",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  vision: true
}
```

5. Add credentials if your app needs sign-in.

For local runs, copy the example env file and fill it with test credentials:

```bash
cp .env.example .env
```

```dotenv
QAOSMONKEY_ADMIN_EMAIL=admin@example.test
QAOSMONKEY_ADMIN_PASSWORD=replace-me
```

Then reference those variables from config. Do not put the actual values in the config file.

```ts
credentials: {
  envFile: ".env",
  accounts: [
    {
      id: "admin",
      description: "Admin test user. Can create projects, manage users, and access billing screens.",
      fields: {
        email: {
          label: "Email",
          env: "QAOSMONKEY_ADMIN_EMAIL"
        },
        password: {
          label: "Password",
          env: "QAOSMONKEY_ADMIN_PASSWORD",
          sensitive: true
        }
      }
    }
  ]
}
```

For CI/CD, set the same environment variables in your secret store and omit `envFile`, or leave it set to `.env` if the file exists only in local development. CI environment variables take precedence.

QAosMonkey gives credential values to the model so it can type them into login forms, but redacts sensitive values before writing `state.json`, `state.jsonl`, and reports.

6. Tune the exploration limits for a smoke test.

Start small. A first run should be short, low-risk, and easy to inspect.

```ts
exploration: {
  goal: "Smoke test login, navigation, empty states, and obvious broken screens.",
  persona: "You are an autonomous Chaos Monkey QA agent. Be curious, adversarial, and systematic.",
  mustTest: [
    "Login must work with the configured test account.",
    "Create post: after tapping Post, the new post should be immediately visible."
  ],
  maxSteps: 20,
  minimumStepsBeforeFinish: 8,
  timeLimitSeconds: 600,
  destructiveLevel: "low",
  maxRepeatedScreenVisits: 4,
  excludedActions: [],
  excludedScreens: ["Payment", "Delete account"],
  allowlistRiskyAreas: []
}
```

7. Run QAosMonkey.

```bash
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

8. Read the report.

```bash
cat .qaos-monkey/runs/<runId>/report.md
cat .qaos-monkey/runs/<runId>/state.json
```

Each run directory contains:

- `report.md`: human-readable report.
- `report.json`: machine-readable report.
- `state.json`: latest persisted run state.
- `state.jsonl`: append-only event trace for every step. This is the main per-step log file for debugging what QAosMonkey did.
- `screenshots/`: screenshots captured during the run.

By default all run artifacts are stored under `.qaos-monkey/runs/<runId>/`. You can change this with `reporting.outputDir`.

## When a Run Stops

QAosMonkey stops a run in these cases:

- The model returns `{"action":"finish"}` and the run has already reached `minimumStepsBeforeFinish`.
- `maxSteps` is reached.
- `timeLimitSeconds` is reached.
- The model asks for human input and the user responds with `/abort`.
- A paused run remains paused until you resume it with `qaosmonkey resume <runId>`.

The model is told to return `finish` only when it has reached the step budget, satisfied the goal and `mustTest` guidance, or sees no meaningful unexplored controls left. QAosMonkey does not blindly accept early `finish`: before `minimumStepsBeforeFinish`, it chooses a simple fallback exploratory action instead.

## Guide What Must Be Tested

Use `exploration.goal` for broad intent and `exploration.mustTest` for specific coverage the agent should prioritize. The items are natural language on purpose: describe what must be true, not the exact taps.

```ts
exploration: {
  goal: "Explore the social app with emphasis on auth, posting, profile visibility, and destructive edge cases.",
  mustTest: [
    "The following features must at least work: login, sign up, create post, delete post.",
    "When creating a post, make sure the post is immediately visible after tapping Post.",
    "When blocking a user, make sure the blocked user can no longer see the blocker profile."
  ]
}
```

QAosMonkey still chooses the concrete path itself, so it can handle different UI layouts and continue exploratory testing around the required checks.

## Human Input During a Run

If the model encounters something it cannot solve itself, it can return `ask_human`. QAosMonkey pauses and prompts you in the terminal.

You can respond with:

- normal text, such as an OTP, email link, test credential, or instruction.
- `/resolved` after you manually fix the blocker in the simulator.
- `/skip` to continue without solving the blocker.
- `/abort` to stop the run and still write artifacts.

Resume a paused run with:

```bash
npm run qaosmonkey -- resume <runId> --config qaos-monkey.config.ts
```

## Console Progress Logging

During `run` and `resume`, QAosMonkey prints progress lines with the `[qaosmonkey]` prefix. These show the current step, screen signature, number of interactive refs, when the model is being called, what action the model chose, whether the device action is executing, and the result.

CLI model providers such as Codex CLI and Claude Code also stream lightweight progress while they are running. If the model command takes a long time, QAosMonkey prints a heartbeat every 10 seconds so you can tell it is still waiting rather than hung.

Configured credential secrets are redacted from runner logs. CLI provider stream logs intentionally summarize model decisions without printing typed values.

To silence progress logs:

```bash
QAOSMONKEY_QUIET=1 npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

## Config Reference

The config file exports a `QAosMonkeyConfig` object. Start from [qaos-monkey.config.example.ts](qaos-monkey.config.example.ts) or generate [qaos-monkey.config.ts](qaos-monkey.config.ts) with `npm run qaosmonkey -- init`.

### `app`

Describes the app under test and how QAosMonkey should launch it.

```ts
app: {
  platform: "ios",
  name: "My App",
  bundleId: "com.example.ios",
  packageName: "com.example.android",
  launchCommand: ["npx", "agent-device", "--platform", "ios", "--udid", "UDID", "open", "com.example.ios"],
  installCommand: ["npx", "agent-device", "--platform", "ios", "install", "com.example.ios", "./MyApp.app"]
}
```

- `platform`: `ios` or `android`.
- `name`: optional human-readable app name used in reports and config clarity.
- `bundleId`: iOS bundle id, such as `com.company.app`.
- `packageName`: Android package name, such as `com.company.app`.
- `launchCommand`: optional explicit command used before a run starts. Prefer this when you need custom `agent-device` flags or deep links.
- `installCommand`: optional command reserved for app installation workflows. The current runner stores it in config but does not automatically execute it yet.

### `device`

Controls which automation driver and simulator/emulator QAosMonkey uses.

```ts
device: {
  driver: "agent-device",
  command: ["npx", "agent-device", "--platform", "ios", "--udid", "UDID"],
  id: "UDID",
  orientation: "portrait",
  resetBeforeRun: false,
  commandMap: {
    snapshot: ["snapshot", "-i"],
    tap: ["click"],
    type: ["fill"],
    press_back: ["back"],
    screenshot: ["screenshot"],
    logs: ["logs"],
    launch: ["open"]
  }
}
```

- `driver`: `agent-device` or `maestro`.
- `command`: base command prepended to all driver actions. Use this to bind platform, UDID, serial, session, or config flags.
- `id`: optional simulator/emulator/device id for documentation and future driver behavior.
- `orientation`: `portrait` or `landscape`. The current runner records this but does not rotate automatically yet.
- `resetBeforeRun`: reserved for app-reset behavior. The current runner records this but does not reset automatically yet.
- `commandMap`: optional overrides for driver subcommands if your local tool version differs from QAosMonkey defaults.

### `model`

Chooses who decides the next action.

```ts
model: {
  provider: "openai-compatible",
  model: "gpt-4o",
  baseUrl: "https://api.openai.com/v1",
  apiKeyEnv: "OPENAI_API_KEY",
  command: ["codex", "exec", "--json"],
  temperature: 0.4,
  maxContextMessages: 30,
  vision: true
}
```

- `provider`: one of `openai-compatible`, `anthropic`, `codex-cli`, or `claude-code`.
- `model`: provider-specific model name.
- `baseUrl`: optional API base URL. Useful for OpenAI-compatible gateways or self-hosted endpoints.
- `apiKeyEnv`: environment variable containing the provider API key. Defaults are `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`.
- `command`: command used by CLI providers. It receives the QAosMonkey prompt on stdin and must print one JSON decision on stdout.
- `temperature`: provider sampling temperature.
- `maxContextMessages`: number of recent QAosMonkey steps included in each model prompt.
- `vision`: when true, API providers include screenshots when available.

Common CLI provider issue:

- `spawn codex ENOENT`: use the full path to the Codex executable in `model.command`, or add Codex to the PATH of the process running QAosMonkey.

### `credentials`

Provides test accounts to the agent without committing secrets.

```ts
credentials: {
  envFile: ".env",
  accounts: [
    {
      id: "admin",
      description: "Admin test user. Can manage users and access privileged screens.",
      fields: {
        email: {
          label: "Email",
          env: "QAOSMONKEY_ADMIN_EMAIL",
          sensitive: false
        },
        password: {
          label: "Password",
          env: "QAOSMONKEY_ADMIN_PASSWORD",
          sensitive: true
        }
      }
    }
  ]
}
```

- `envFile`: optional dotenv-style file loaded before a run. `.env` is ignored by git.
- `accounts`: list of test accounts the model may use.
- `id`: short account identifier shown to the model, such as `admin` or `free_user`.
- `description`: tells the model what the account can do, for example “this user is an admin.”
- `fields`: named credential fields. Common keys are `email`, `username`, `password`, `otpSeed`, or `apiToken`.
- `fields.*.label`: human-readable field label for the model.
- `fields.*.env`: environment variable that contains the actual value.
- `fields.*.sensitive`: defaults to `true`. Sensitive values are redacted from persisted run state and reports.

CI/CD usage:

```bash
QAOSMONKEY_ADMIN_EMAIL=admin@example.test \
QAOSMONKEY_ADMIN_PASSWORD=secret \
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

Safety notes:

- Put real values in `.env` or CI/CD secrets, not in `qaos-monkey.config.ts`.
- Keep `.env.example` with fake values only.
- The model receives credential values so it can sign in. Use dedicated test accounts and non-production environments.
- QAosMonkey redacts configured sensitive values before writing artifacts, including failed command errors that may echo typed text.

### `exploration`

Controls what the agent is trying to do and how far it may go.

```ts
exploration: {
  goal: "Smoke test login, navigation, empty states, and obvious broken screens.",
  persona: "You are an autonomous Chaos Monkey QA agent. Be curious, adversarial, and systematic.",
  mustTest: [
    "Login must work with the configured test account.",
    "Create post: after tapping Post, the new post should be immediately visible.",
    "Blocking a user: the blocked user should no longer be able to see the blocker profile."
  ],
  maxSteps: 20,
  timeLimitSeconds: 600,
  destructiveLevel: "low",
  maxRepeatedScreenVisits: 4,
  excludedActions: [],
  excludedScreens: ["Payment", "Delete account"],
  allowlistRiskyAreas: []
}
```

- `goal`: task-level instruction given to the model on every decision.
- `persona`: behavioral instruction that shapes exploration style.
- `mustTest`: natural-language required coverage. Use this for features, assertions, and business rules that must be exercised at least once while still letting the model decide the exact path.
- `maxSteps`: hard cap on model decisions in a run.
- `minimumStepsBeforeFinish`: prevents a model from ending the run too early. If the model returns `finish` before this many steps, QAosMonkey picks a simple fallback exploratory action instead.
- `timeLimitSeconds`: hard cap on run duration.
- `destructiveLevel`: `low`, `medium`, or `high`; tells the model how aggressive it may be.
- `maxRepeatedScreenVisits`: number of visits to the same screen signature before QAosMonkey records a blocker-style finding.
- `excludedActions`: action names the runner must skip, such as `type` or `press_back`.
- `excludedScreens`: case-insensitive screen names or destination labels to avoid. QAosMonkey treats title/header-like text as the current screen identity and blocks taps/types/scrolls/swipes on controls whose own label matches an excluded screen. A login page that merely contains a small `Forgot password` link will still be testable, but tapping that link is blocked.
- `allowlistRiskyAreas`: names of risky areas the model may interact with. Use this to explicitly permit flows like payment, account deletion, or production-impacting actions later.

### `humanInput`

Controls how QAosMonkey asks for help.

```ts
humanInput: {
  provider: "cli"
}
```

- `provider`: currently only `cli`. The terminal prompts you when the model returns `ask_human`.

### `reporting`

Controls where artifacts go.

```ts
reporting: {
  outputDir: ".qaos-monkey/runs",
  retainScreenshots: true
}
```

- `outputDir`: root directory for run artifacts.
- `retainScreenshots`: when true, QAosMonkey asks the driver to save screenshots for observations.

## Supported Model Actions

Every model provider must return one JSON object using one of these actions:

```json
{"action":"tap","ref":"@e1","reason":"Open the login form"}
{"action":"tap","x":120,"y":340,"reason":"Fallback coordinate tap"}
{"action":"type","ref":"@e2","value":"bad@example.com","submit":false,"reason":"Try invalid email"}
{"action":"scroll","direction":"down","reason":"Look for more settings"}
{"action":"swipe","direction":"left","reason":"Test carousel navigation"}
{"action":"press_back","reason":"Check back navigation"}
{"action":"dismiss_overlay","reason":"React Native warning/error overlay is blocking the app"}
{"action":"wait","milliseconds":1000,"reason":"Wait for loading"}
{"action":"ask_human","reason":"Captcha blocks progress","options":["provided","resolved","skip","abort"]}
{"action":"log_bug","finding":{"severity":"high","category":"functional","title":"Login button does nothing","description":"Tapping Login has no visible effect.","expected":"Login should submit or show validation.","actual":"No change after tap.","stepsToReproduce":["Open app","Tap Login"],"confidence":0.8},"reason":"Observed no-op on primary action"}
{"action":"finish","reason":"Smoke coverage target reached"}
```

The runner validates refs against the current accessibility snapshot before executing tap/type actions.

## Device Driver Notes

The default driver wraps `agent-device` commands:

- snapshot: `snapshot -i`
- tap: `click`
- type into field: `fill`
- scroll: `scroll`
- swipe: `swipe`
- back: `back`
- screenshot: `screenshot`
- launch: `open`

If your installed `agent-device` version uses different command names, override them in `device.commandMap`.

## Useful Commands

```bash
npm test
npm run qaosmonkey -- --help
npm run qaosmonkey -- init
npm run qaosmonkey -- run --config qaos-monkey.config.ts
npm run qaosmonkey -- resume <runId> --config qaos-monkey.config.ts
npm run qaosmonkey -- report <runId> --config qaos-monkey.config.ts
```

## Publishing to npm

The npm package name is `qaosmonkey`, not `qaos-monkey`. This follows the project naming rule: use `QAosMonkey` for the brand, `qaosmonkey` for terminal and package registry identifiers, and `qaos-monkey` for files and directories.

Publishing is handled by [.github/workflows/publish-npm.yml](.github/workflows/publish-npm.yml). The workflow runs tests, shows `npm pack --dry-run`, and publishes the root package only. The website is excluded through `package.json` `files` and [.npmignore](.npmignore).

To enable publishing:

1. Create an npm access token for the `qaosmonkey` package.
2. Add it to the GitHub repository secrets as `NPM_TOKEN`.
3. Create and publish a GitHub Release, or run the workflow manually from GitHub Actions.

You can verify the package contents locally with:

```bash
npm pack --dry-run
```

## Dependency Links

The published `qaosmonkey` package currently uses Node.js built-ins for its core runtime and calls external tools or APIs through configuration. These are the main projects and services QAosMonkey integrates with:

- [Node.js](https://nodejs.org/) for the CLI runtime.
- [agent-device](https://github.com/callstackincubator/agent-device) as the default iOS/Android device driver.
- [Maestro](https://maestro.mobile.dev/) as the optional fallback driver.
- [OpenAI API](https://platform.openai.com/docs) for OpenAI-compatible model providers.
- [Anthropic Claude API](https://docs.anthropic.com/) for Anthropic model providers.
- [Codex CLI](https://developers.openai.com/codex/cli/) for local CLI-based model execution.
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) for local CLI-based model execution.

The documentation website is a separate private package under `website/`. Its main dependencies are:

- [Docusaurus](https://docusaurus.io/) for the documentation site.
- [React](https://react.dev/) and [React DOM](https://react.dev/reference/react-dom) for the website UI.
- [MDX](https://mdxjs.com/) for docs content.
- [clsx](https://github.com/lukeed/clsx) for conditional CSS class names.
- [Prism React Renderer](https://github.com/FormidableLabs/prism-react-renderer) for code highlighting.

For dependency license notes, see [THIRD_PARTY_LICENSES_SUMMARY.md](THIRD_PARTY_LICENSES_SUMMARY.md).
