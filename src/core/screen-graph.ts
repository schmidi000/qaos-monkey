import type { AgentDecision, ScreenGraphSnapshot } from "../types.ts";

export class ScreenGraph {
  private nodes = new Map<string, { signature: string; visits: number; sample: string }>();
  private edges = new Map<string, { from: string; to: string; action: string; count: number }>();

  static fromSnapshot(snapshot?: ScreenGraphSnapshot): ScreenGraph {
    const graph = new ScreenGraph();
    for (const node of snapshot?.nodes ?? []) {
      graph.nodes.set(node.signature, { ...node });
    }
    for (const edge of snapshot?.edges ?? []) {
      graph.edges.set(edgeKey(edge.from, edge.to, edge.action), { ...edge });
    }
    return graph;
  }

  visit(signature: string, sample: string): number {
    const existing = this.nodes.get(signature);
    if (existing) {
      existing.visits += 1;
      return existing.visits;
    }
    this.nodes.set(signature, { signature, visits: 1, sample: sample.slice(0, 500) });
    return 1;
  }

  edge(from: string, to: string, decision: AgentDecision): void {
    const action = describeDecision(decision);
    const key = edgeKey(from, to, action);
    const existing = this.edges.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.edges.set(key, { from, to, action, count: 1 });
  }

  toJSON(): ScreenGraphSnapshot {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()]
    };
  }
}

export function describeDecision(decision: AgentDecision): string {
  if (decision.action === "tap") return `tap:${decision.ref ?? `${decision.x},${decision.y}`}`;
  if (decision.action === "type") return `type:${decision.ref ?? "focused"}`;
  if (decision.action === "scroll" || decision.action === "swipe") return `${decision.action}:${decision.direction}`;
  return decision.action;
}

function edgeKey(from: string, to: string, action: string): string {
  return `${from}->${to}:${action}`;
}

