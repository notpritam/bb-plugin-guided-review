import { test, expect } from "vitest";
import { toGithubReviewPayload, type Draft } from "./draft";

const draft: Draft = {
  targetKey: "pr-1",
  verdict: "REQUEST_CHANGES",
  body: "Overall looks close.",
  comments: [{ file: "src/a.ts", line: 42, side: "RIGHT", chapterId: "s1", body: "rename this" }],
};

test("maps a draft to the gh reviews API body", () => {
  expect(toGithubReviewPayload(draft)).toEqual({
    event: "REQUEST_CHANGES",
    body: "Overall looks close.",
    comments: [{ path: "src/a.ts", line: 42, side: "RIGHT", body: "rename this" }],
  });
});
