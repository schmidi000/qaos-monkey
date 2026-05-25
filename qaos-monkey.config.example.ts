const config = {
  app: {
    platform: "android",
    name: "Example App",
    packageName: "com.example.app",
    launchCommand: ["agent-device", "launch", "com.example.app"]
  },
  device: {
    driver: "agent-device",
    command: ["agent-device"],
    id: undefined,
    orientation: "portrait",
    resetBeforeRun: false
  },
  model: {
    provider: "codex-cli",
    command: ["codex", "exec", "--json", "--skip-git-repo-check"],
    model: "gpt-5",
    temperature: 0.4,
    maxContextMessages: 30,
    vision: true
  },
  credentials: {
    envFile: ".env",
    accounts: [
      {
        id: "admin",
        description: "Admin test user. Can access privileged admin-only areas in non-production environments.",
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
  },
  exploration: {
    goal: "Explore the app, discover screens, try edge cases, and report broken behavior.",
    persona: "You are an autonomous Chaos Monkey QA agent. Be curious, adversarial, and systematic.",
    mustTest: [
      "Login must work with the configured test account.",
      "Sign up should show useful validation for missing or invalid fields.",
      "Create post: after tapping Post, the new post should be immediately visible.",
      "Delete post: after deleting a post, it should no longer appear in the feed."
    ],
    maxSteps: 50,
    minimumStepsBeforeFinish: 8,
    timeLimitSeconds: 1800,
    destructiveLevel: "medium",
    maxRepeatedScreenVisits: 4,
    excludedActions: [],
    excludedScreens: [],
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
