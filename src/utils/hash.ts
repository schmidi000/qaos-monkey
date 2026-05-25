import { createHash } from "node:crypto";

export function sha1(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

export function normalizeSnapshot(snapshot: string): string {
  return snapshot
    .replace(/@[a-zA-Z]?\d+/g, "@ref")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

