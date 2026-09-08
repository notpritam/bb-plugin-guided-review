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

test("different repositories and local workspaces never share review or draft keys", () => {
  const first = targetKey({ kind: "pr", repo: "acme/web", number: 7 });
  expect(first).not.toBe(targetKey({ kind: "pr", repo: "acme/api", number: 7 }));
  expect(first).toBe(targetKey({ kind: "pr", repo: "ACME/Web", number: 7 }));
  expect(first).toMatch(/^[a-z0-9-]+$/);
  const ref = { kind: "ref" as const, gitRef: "HEAD" };
  expect(targetKey(ref, { projectId: "p1", cwd: "/a" })).not.toBe(targetKey(ref, { projectId: "p1", cwd: "/b" }));
  expect(targetKey(ref, { projectId: "p1", cwd: "/a" })).not.toBe(targetKey(ref, { projectId: "p2", cwd: "/a" }));
});

test.each(["https://evilgithub.com/acme/web/pull/7", "https://example.com/github.com/acme/web/pull/7", "https://github.com/acme/web/pull/7oops", "https://github.com/acme/web/pull/0"])("rejects misleading PR URL %s", (url) => {
  expect(parseTarget(url).kind).toBe("ref");
});
