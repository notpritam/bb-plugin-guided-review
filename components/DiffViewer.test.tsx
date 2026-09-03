// @vitest-environment jsdom
import { test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Render only our chrome, not @pierre/diffs' internals.
vi.mock("@pierre/diffs/react", () => ({ FileDiff: () => <div data-testid="filediff" /> }));

import { DiffViewer, type FileViewFlags } from "./DiffViewer";

afterEach(cleanup);

const patch = "diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1,2 @@\n-old\n+new\n+more\n";

test("renders a file header with path, additions/deletions, and a Viewed checkbox", () => {
  render(
    <DiffViewer
      patch={patch}
      files={["src/a.ts"]}
      views={new Map<string, FileViewFlags>()}
      onToggleViewed={() => {}}
    />,
  );
  expect(screen.getByText("src/a.ts")).toBeTruthy();
  expect(screen.getByText("+2")).toBeTruthy();
  expect(screen.getByText("−1")).toBeTruthy();
  expect(screen.getByTestId("filediff")).toBeTruthy(); // expanded body present
});

test("checking Viewed reports up and collapses the diff body", () => {
  const onToggleViewed = vi.fn();
  render(
    <DiffViewer
      patch={patch}
      files={["src/a.ts"]}
      views={new Map<string, FileViewFlags>()}
      onToggleViewed={onToggleViewed}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox"));
  expect(onToggleViewed).toHaveBeenCalledWith("src/a.ts", true);
  expect(screen.queryByTestId("filediff")).toBeNull(); // collapsed
});

test("a stale file shows a 'changed' pill", () => {
  render(
    <DiffViewer
      patch={patch}
      files={["src/a.ts"]}
      views={new Map<string, FileViewFlags>([["src/a.ts", { viewed: false, stale: true }]])}
      onToggleViewed={() => {}}
    />,
  );
  expect(screen.getByText("changed")).toBeTruthy();
});
