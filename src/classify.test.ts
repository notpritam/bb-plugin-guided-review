import { test, expect } from "vitest";
import { classifyFile } from "./classify";

test("tests are skippable", () => {
  for (const p of [
    "src/foo.test.ts",
    "src/foo.spec.tsx",
    "components/__tests__/Bar.tsx",
    "src/__snapshots__/x.snap",
    "x.test.js.snap",
  ]) {
    const c = classifyFile(p);
    expect(c.category, p).toBe("test");
    expect(c.skippable, p).toBe(true);
  }
});

test("lockfiles are skippable", () => {
  for (const p of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "Cargo.lock"]) {
    const c = classifyFile(p);
    expect(c.category, p).toBe("lockfile");
    expect(c.skippable, p).toBe(true);
  }
});

test("generated/build output is skippable", () => {
  for (const p of ["dist/app.js", "build/index.html", "app.min.js", "src/api.generated.ts"]) {
    const c = classifyFile(p);
    expect(c.category, p).toBe("generated");
    expect(c.skippable, p).toBe(true);
  }
});

test("docs and config are recognized but not skippable", () => {
  expect(classifyFile("README.md").category).toBe("docs");
  expect(classifyFile("docs/guide.md").category).toBe("docs");
  expect(classifyFile("tsconfig.json").category).toBe("config");
  expect(classifyFile(".eslintrc.yml").category).toBe("config");
  expect(classifyFile("README.md").skippable).toBe(false);
});

test("ordinary source is code and not skippable", () => {
  const c = classifyFile("src/server.ts");
  expect(c.category).toBe("code");
  expect(c.skippable).toBe(false);
});

test("a test file that also looks like code resolves as test (test wins)", () => {
  expect(classifyFile("src/deep/module.test.ts").category).toBe("test");
});

test("every result carries a short human label", () => {
  expect(classifyFile("a.test.ts").label).toBe("test");
  expect(classifyFile("yarn.lock").label).toBe("lockfile");
  expect(classifyFile("dist/x.js").label).toBe("generated");
});
