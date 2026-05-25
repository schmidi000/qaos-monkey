import test from "node:test";
import assert from "node:assert/strict";
import { dedupeFindings } from "../src/reporting/reporter.ts";
import type { Finding } from "../src/types.ts";

test("dedupeFindings merges same category title and screen", () => {
  const base: Finding = {
    id: "a",
    severity: "high",
    category: "functional",
    title: "Broken login",
    description: "Login fails",
    stepsToReproduce: ["tap login"],
    confidence: 0.8,
    firstSeenStep: 1,
    lastSeenStep: 1,
    screenSignature: "screen",
    screenshots: ["1.png"]
  };
  const deduped = dedupeFindings([
    base,
    { ...base, id: "b", firstSeenStep: 2, lastSeenStep: 2, screenshots: ["2.png"] }
  ]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].lastSeenStep, 2);
  assert.deepEqual(deduped[0].screenshots, ["1.png", "2.png"]);
});

