import test from "node:test";
import assert from "node:assert/strict";
import { parseDecision } from "../src/utils/json.ts";

test("parseDecision extracts fenced JSON", () => {
  const decision = parseDecision('```json\n{"action":"tap","ref":"@e1","reason":"try login"}\n```');
  assert.equal(decision.action, "tap");
  assert.equal(decision.ref, "@e1");
});

test("parseDecision rejects unsupported actions", () => {
  assert.throws(() => parseDecision('{"action":"delete_app"}'), /Unsupported model action/);
});

test("parseDecision validates direction actions", () => {
  assert.throws(() => parseDecision('{"action":"scroll","direction":"north","reason":"bad"}'), /requires direction/);
});

