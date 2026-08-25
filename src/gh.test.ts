import { test, expect } from "vitest";
import {
  ghPrViewArgs, ghPrDiffArgs, ghRepoViewArgs, ghSubmitReviewArgs, gitDiffArgs,
  ghPrChecksJsonArgs, ghPrHeadArgs, ghReviewThreadsArgs, ghReplyThreadArgs,
  ghResolveThreadArgs, ghUnresolveThreadArgs,
} from "./gh";

test("pr view requests the json fields we need, with optional -R", () => {
  expect(ghPrViewArgs(12)).toEqual([
    "pr", "view", "12", "--json", "number,title,body,author,baseRefName,headRefName,url,headRefOid",
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

test("pr checks json requests the fields we need, with optional -R", () => {
  expect(ghPrChecksJsonArgs(12)).toEqual([
    "pr", "checks", "12", "--json", "name,state,bucket,link",
  ]);
  expect(ghPrChecksJsonArgs(12, "acme/web")).toEqual([
    "pr", "checks", "12", "--json", "name,state,bucket,link", "-R", "acme/web",
  ]);
});

test("pr head requests headRefOid and reviewDecision, with optional -R", () => {
  expect(ghPrHeadArgs(12)).toEqual([
    "pr", "view", "12", "--json", "headRefOid,reviewDecision",
  ]);
  expect(ghPrHeadArgs(12, "acme/web")).toEqual([
    "pr", "view", "12", "--json", "headRefOid,reviewDecision", "-R", "acme/web",
  ]);
});

test("review threads args build a graphql query with owner/repo/number vars", () => {
  const args = ghReviewThreadsArgs("acme", "web", 12);
  expect(args[0]).toBe("api");
  expect(args[1]).toBe("graphql");
  expect(args[2]).toBe("-f");
  expect(args[3]).toContain("query=");
  expect(args[3]).toContain("reviewThreads");
  expect(args).toContain("-F");
  expect(args).toEqual(expect.arrayContaining(["owner=acme", "repo=web", "number=12"]));
});

test("reply thread args post to the pr comment replies endpoint reading json from stdin", () => {
  expect(ghReplyThreadArgs("acme/web", 12, 999)).toEqual([
    "api", "-X", "POST", "repos/acme/web/pulls/12/comments/999/replies", "--input", "-",
  ]);
});

test("resolve thread args build a graphql mutation with the thread id", () => {
  const args = ghResolveThreadArgs("THREAD_ID");
  expect(args[0]).toBe("api");
  expect(args[1]).toBe("graphql");
  expect(args[2]).toBe("-f");
  expect(args[3]).toContain("resolveReviewThread");
  expect(args).toContain("-F");
  expect(args).toContain("id=THREAD_ID");
});

test("unresolve thread args build a graphql mutation with the thread id", () => {
  const args = ghUnresolveThreadArgs("THREAD_ID");
  expect(args[0]).toBe("api");
  expect(args[1]).toBe("graphql");
  expect(args[2]).toBe("-f");
  expect(args[3]).toContain("unresolveReviewThread");
  expect(args).toContain("-F");
  expect(args).toContain("id=THREAD_ID");
});
