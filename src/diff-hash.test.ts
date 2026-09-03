import { test, expect } from "vitest";
import { hashFileDiff } from "./diff-hash";

test("hash is stable for identical input", () => {
  const a = hashFileDiff("diff --git a/x b/x\n+hello\n");
  const b = hashFileDiff("diff --git a/x b/x\n+hello\n");
  expect(a).toBe(b);
});

test("hash changes when the diff text changes", () => {
  const a = hashFileDiff("+hello\n");
  const b = hashFileDiff("+hello world\n");
  expect(a).not.toBe(b);
});

test("hash is a lowercase hex sha256 (64 chars)", () => {
  const h = hashFileDiff("anything");
  expect(h).toMatch(/^[0-9a-f]{64}$/);
});
