import test from "node:test";
import assert from "node:assert/strict";
import { runCommandOrThrow } from "../src/utils/subprocess.ts";

test("runCommandOrThrow reports a helpful ENOENT message", async () => {
  await assert.rejects(
    () => runCommandOrThrow(["qaosmonkey-missing-executable-for-test"]),
    /not found on PATH|Failed to spawn command/
  );
});

