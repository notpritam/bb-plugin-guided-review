import { test, expect } from "vitest";
import { computeFileViewState, hashForFile } from "./file-views";

const patch = "diff --git a/a.ts b/a.ts\n+one\n" + "diff --git a/b.ts b/b.ts\n+two\n";

test("a file marked viewed at its current hash reads as viewed, not stale", () => {
  const hash = hashForFile(patch, "a.ts")!;
  const state = computeFileViewState([{ file: "a.ts", hash, viewedAt: 1 }], patch);
  expect(state).toEqual([{ file: "a.ts", viewed: true, stale: false }]);
});

test("a file whose diff changed since viewing reads as stale, not viewed", () => {
  const state = computeFileViewState([{ file: "a.ts", hash: "old-hash", viewedAt: 1 }], patch);
  expect(state).toEqual([{ file: "a.ts", viewed: false, stale: true }]);
});

test("hashForFile returns null for a file not in the patch", () => {
  expect(hashForFile(patch, "missing.ts")).toBeNull();
});
