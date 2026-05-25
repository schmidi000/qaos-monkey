---
id: configuration
title: Configuration
---

# Configuration

QAosMonkey is configured with a TypeScript file that exports a config object.

```ts
const config = {
  app: {
    platform: "ios",
    name: "My App",
    bundleId: "com.example.app"
  },
  device: {
    driver: "agent-device",
    command: ["npx", "agent-device", "--platform", "ios", "--udid", "YOUR_SIMULATOR_UDID"]
  },
  model: {
    provider: "codex-cli",
    command: ["codex", "exec", "--json", "--skip-git-repo-check"],
    model: "gpt-5"
  },
  exploration: {
    goal: "Smoke test login, navigation, empty states, and obvious broken screens.",
    persona: "You are an autonomous Chaos Monkey QA agent. Be curious, adversarial, and systematic.",
    mustTest: [
      "Login must work with the configured test account.",
      "Create post: after tapping Post, the new post should be immediately visible.",
      "Blocking a user: the blocked user should no longer be able to see the blocker profile."
    ],
    maxSteps: 20,
    minimumStepsBeforeFinish: 8,
    timeLimitSeconds: 600,
    destructiveLevel: "low",
    maxRepeatedScreenVisits: 4,
    excludedActions: [],
    excludedScreens: ["Payment", "Delete account"],
    allowlistRiskyAreas: []
  },
  humanInput: {
    provider: "cli"
  },
  reporting: {
    outputDir: ".qaos-monkey/runs",
    retainScreenshots: true
  }
};

export default config;
```

## Model Commands

If `codex` is not on PATH, set the full executable path:

```ts
command: ["/Applications/Codex.app/Contents/Resources/codex", "exec", "--json", "--skip-git-repo-check"]
```

CLI providers receive the full QAosMonkey prompt on stdin and must print one JSON decision on stdout.

## Required Coverage Guidance

Use `exploration.goal` for the broad mission and `exploration.mustTest` for specific behavior that must be exercised. Keep these items in natural language and describe the outcome you care about, not the exact sequence of taps.

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

QAosMonkey passes this list to the model on every decision. The model should prioritize it as required coverage while still choosing the concrete route through the app.
