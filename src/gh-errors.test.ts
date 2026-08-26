import { test, expect } from "vitest";
import { describeGhFailure } from "./gh-errors";

test("404 with repo+account produces an actionable wrong-account message", () => {
  const msg = describeGhFailure({
    stderr: "gh: Not Found (HTTP 404)",
    repo: "acme/widgets",
    activeAccount: "monalisa",
  });
  expect(msg).toContain("monalisa");
  expect(msg).toContain("acme/widgets");
  expect(msg.toLowerCase()).toContain("switch");
  expect(msg.toLowerCase()).toContain("account bar");
});

test("403 (e.g. 'must have admin rights') also produces the actionable message", () => {
  const msg = describeGhFailure({
    stderr: "HTTP 403: Must have admin rights to Repository.",
    repo: "acme/widgets",
    activeAccount: "octocat",
  });
  expect(msg).toContain("octocat");
  expect(msg).toContain("acme/widgets");
  expect(msg.toLowerCase()).toContain("switch");
});

test("'resource not accessible' signature is treated as a permission failure", () => {
  const msg = describeGhFailure({
    stderr: "Resource not accessible by integration",
    repo: "acme/widgets",
    activeAccount: "octocat",
  });
  expect(msg.toLowerCase()).toContain("switch");
});

test("falls back gracefully when activeAccount is absent", () => {
  const msg = describeGhFailure({ stderr: "gh: Not Found (HTTP 404)", repo: "acme/widgets" });
  expect(msg).toContain("The active GitHub account");
  expect(msg).toContain("acme/widgets");
});

test("falls back gracefully when repo is absent", () => {
  const msg = describeGhFailure({ stderr: "gh: Not Found (HTTP 404)", activeAccount: "monalisa" });
  expect(msg).toContain("monalisa");
  expect(msg.toLowerCase()).not.toContain("undefined");
});

test("falls back gracefully when both repo and activeAccount are absent", () => {
  const msg = describeGhFailure({ stderr: "gh: Not Found (HTTP 404)" });
  expect(msg).toContain("The active GitHub account");
  expect(msg.toLowerCase()).toContain("switch");
  expect(msg.toLowerCase()).not.toContain("undefined");
});

test("generic errors pass through as the trimmed stderr", () => {
  const msg = describeGhFailure({ stderr: "  gh pr diff failed: network timeout  \n" });
  expect(msg).toBe("gh pr diff failed: network timeout");
});

test("empty stderr yields a generic message", () => {
  expect(describeGhFailure({ stderr: "" })).toBe("GitHub request failed");
  expect(describeGhFailure({ stderr: "   \n " })).toBe("GitHub request failed");
});

test("matching is case-insensitive", () => {
  const msg = describeGhFailure({ stderr: "GH: NOT FOUND (http 404)", repo: "acme/widgets" });
  expect(msg.toLowerCase()).toContain("switch");
});
