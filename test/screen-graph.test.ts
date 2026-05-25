import test from "node:test";
import assert from "node:assert/strict";
import { ScreenGraph } from "../src/core/screen-graph.ts";

test("ScreenGraph records visits and edges", () => {
  const graph = new ScreenGraph();
  assert.equal(graph.visit("a", "Login"), 1);
  assert.equal(graph.visit("a", "Login"), 2);
  graph.visit("b", "Home");
  graph.edge("a", "b", { action: "tap", ref: "@e1", reason: "open" });
  graph.edge("a", "b", { action: "tap", ref: "@e1", reason: "open again" });
  const snapshot = graph.toJSON();
  assert.equal(snapshot.nodes.length, 2);
  assert.equal(snapshot.edges[0].count, 2);
});

