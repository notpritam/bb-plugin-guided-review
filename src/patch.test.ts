import { test, expect } from "vitest";
import { ensureGitHeaders, splitPatchByFile, changedFiles } from "./patch";

const withHeader = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+new
`;

const noHeader = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+new
`;

test("ensureGitHeaders adds a missing diff --git line", () => {
  expect(ensureGitHeaders(noHeader)).toContain("diff --git a/src/a.ts b/src/a.ts");
});

test("ensureGitHeaders leaves an existing header untouched", () => {
  expect(ensureGitHeaders(withHeader)).toBe(withHeader);
});

test("changedFiles lists repo-relative paths", () => {
  const two = withHeader + `diff --git a/src/b.ts b/src/b.ts
--- a/src/b.ts
+++ b/src/b.ts
@@ -1 +1 @@
-x
+y
`;
  expect(changedFiles(two)).toEqual(["src/a.ts", "src/b.ts"]);
});

test("splitPatchByFile returns one entry per file with its own header", () => {
  const files = splitPatchByFile(withHeader);
  expect(files).toHaveLength(1);
  expect(files[0].path).toBe("src/a.ts");
  expect(files[0].text).toContain("diff --git a/src/a.ts");
});
