import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfig } from "../src/config.ts";
import { loadCredentialEnvFile, resolveCredentials } from "../src/credentials.ts";
import type { QAosMonkeyConfig } from "../src/types.ts";

test("credentials can be loaded from dotenv file and resolved from env vars", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-creds-"));
  const envPath = join(root, ".env");
  await writeFile(envPath, "QAOSMONKEY_DOTENV_EMAIL=dotenv@example.test\nQAOSMONKEY_DOTENV_PASSWORD=\"dotenv-secret\"\n", "utf8");
  delete process.env.QAOSMONKEY_DOTENV_EMAIL;
  delete process.env.QAOSMONKEY_DOTENV_PASSWORD;
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    credentials: {
      envFile: ".env",
      accounts: [
        {
          id: "dotenv-user",
          description: "User loaded from dotenv.",
          fields: {
            email: { env: "QAOSMONKEY_DOTENV_EMAIL", sensitive: false },
            password: { env: "QAOSMONKEY_DOTENV_PASSWORD" }
          }
        }
      ]
    }
  };
  await loadCredentialEnvFile(config, join(root, "qaos-monkey.config.ts"));
  const credentials = resolveCredentials(config);
  assert.equal(credentials[0].fields.find((field) => field.key === "email")?.value, "dotenv@example.test");
  assert.equal(credentials[0].fields.find((field) => field.key === "password")?.value, "dotenv-secret");
  await rm(root, { recursive: true, force: true });
});

test("missing dotenv file is allowed when CI environment already has credential vars", async () => {
  const root = await mkdtemp(join(tmpdir(), "qaosmonkey-creds-"));
  process.env.QAOSMONKEY_CI_EMAIL = "ci@example.test";
  process.env.QAOSMONKEY_CI_PASSWORD = "ci-secret";
  const config: QAosMonkeyConfig = {
    ...defaultConfig,
    credentials: {
      envFile: ".env",
      accounts: [
        {
          id: "ci-user",
          description: "User loaded from CI secrets.",
          fields: {
            email: { env: "QAOSMONKEY_CI_EMAIL" },
            password: { env: "QAOSMONKEY_CI_PASSWORD" }
          }
        }
      ]
    }
  };
  await loadCredentialEnvFile(config, join(root, "qaos-monkey.config.ts"));
  const credentials = resolveCredentials(config);
  assert.equal(credentials[0].fields.find((field) => field.key === "password")?.value, "ci-secret");
  await rm(root, { recursive: true, force: true });
});
