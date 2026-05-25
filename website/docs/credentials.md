---
id: credentials
title: Safe Credentials
---

# Safe Credentials

Credentials should live in environment variables or CI/CD secrets, not directly in config files.

For local runs:

```bash
cp .env.example .env
```

```dotenv
QAOSMONKEY_ADMIN_EMAIL=admin@example.test
QAOSMONKEY_ADMIN_PASSWORD=replace-me
```

Reference those values from config:

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

For CI/CD, set the same environment variables in your secret store and run:

```bash
npm run qaosmonkey -- run --config qaos-monkey.config.ts
```

Sensitive values are redacted from persisted state, reports, and command errors.

