import test from "node:test";
import assert from "node:assert/strict";
import { extractDecisionText } from "../src/models/cli-provider.ts";
import { parseDecision } from "../src/utils/json.ts";

test("extractDecisionText reads Codex JSONL agent messages", () => {
  const output = [
    '{"type":"thread.started","thread_id":"abc"}',
    '2026-05-25T12:18:25Z WARN noisy log line',
    '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"{\\"action\\":\\"finish\\",\\"reason\\":\\"done\\"}"}}',
    '{"type":"turn.completed","usage":{"input_tokens":1}}'
  ].join("\n");
  const decision = parseDecision(extractDecisionText(output));
  assert.equal(decision.action, "finish");
  assert.equal(decision.reason, "done");
});

