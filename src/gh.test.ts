import { test, expect } from "vitest";
import {
  ghPrViewArgs, ghPrDiffArgs, ghRepoViewArgs, ghSubmitReviewArgs, gitDiffArgs,
} from "./gh";

test("pr view requests the json fields we need, with optional -R", () => {
  expect(ghPrViewArgs(12)).toEqual([
    "pr", "view", "12", "--json", "number,title,body,author,baseRefName,headRefName,url",
  ]);
  expect(ghPrViewArgs(12, "acme/web")).toContain("-R");
});

test("pr diff targets the number", () => {
  expect(ghPrDiffArgs(12)).toEqual(["pr", "diff", "12"]);
});

test("repo view returns nameWithOwner", () => {
  expect(ghRepoViewArgs()).toEqual(["repo", "view", "--json", "nameWithOwner"]);
});

test("submit review posts to the reviews endpoint reading json from stdin", () => {
  expect(ghSubmitReviewArgs("acme/web", 12)).toEqual([
    "api", "-X", "POST", "repos/acme/web/pulls/12/reviews", "--input", "-",
  ]);
});

test("git diff builds a range", () => {
  expect(gitDiffArgs("feature/x", "main")).toEqual(["diff", "main...feature/x"]);
  expect(gitDiffArgs("main...HEAD")).toEqual(["diff", "main...HEAD"]);
});
