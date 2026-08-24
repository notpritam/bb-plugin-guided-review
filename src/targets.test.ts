import { test, expect } from "vitest";
import { parseTarget, targetKey } from "./targets";

test("parses a PR url", () => {
  expect(parseTarget("https://github.com/acme/web/pull/1234")).toEqual({
    kind: "pr", number: 1234, repo: "acme/web",
  });
});

test("parses a bare PR number", () => {
  expect(parseTarget("1234")).toEqual({ kind: "pr", number: 1234 });
});

test("parses a range ref", () => {
  expect(parseTarget("origin/main...HEAD")).toEqual({ kind: "ref", gitRef: "origin/main...HEAD" });
});

test("parses a branch ref with base", () => {
  expect(parseTarget("feature/x", "main")).toEqual({ kind: "ref", gitRef: "feature/x", base: "main" });
});

test("targetKey is stable and kind-prefixed", () => {
  expect(targetKey({ kind: "pr", number: 1234 })).toBe("pr-1234");
  const a = targetKey({ kind: "ref", gitRef: "feature/x", base: "main" });
  const b = targetKey({ kind: "ref", gitRef: "feature/x", base: "main" });
  expect(a).toBe(b);
  expect(a.startsWith("ref-")).toBe(true);
});
