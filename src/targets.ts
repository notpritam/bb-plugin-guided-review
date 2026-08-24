import { createHash } from "node:crypto";

export type ReviewTarget =
  | { kind: "pr"; number: number; repo?: string }
  | { kind: "ref"; gitRef: string; base?: string };

const PR_URL = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/;

export function parseTarget(input: string, base?: string): ReviewTarget {
  const trimmed = input.trim();
  const url = trimmed.match(PR_URL);
  if (url) return { kind: "pr", number: Number(url[2]), repo: url[1] };
  if (/^\d+$/.test(trimmed)) return { kind: "pr", number: Number(trimmed) };
  return base ? { kind: "ref", gitRef: trimmed, base } : { kind: "ref", gitRef: trimmed };
}

export function targetKey(t: ReviewTarget): string {
  if (t.kind === "pr") return `pr-${t.number}`;
  const hash = createHash("sha1")
    .update(`${t.gitRef}|${t.base ?? ""}`)
    .digest("hex")
    .slice(0, 12);
  return `ref-${hash}`;
}
