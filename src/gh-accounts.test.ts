import { test, expect, vi } from "vitest";
import { parseGhAccounts, getGhAccounts, switchGhAccount, checkRepoAccess } from "./gh-accounts";

const STATUS_SAMPLE = `github.com
  ✓ Logged in to github.com account monalisa (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo'

  ✓ Logged in to github.com account octocat (keyring)
  - Active account: false
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo'
`;

test("parseGhAccounts extracts logins after 'account <login>', skipping 'Active account: true/false'", () => {
  expect(parseGhAccounts(STATUS_SAMPLE)).toEqual(["monalisa", "octocat"]);
});

test("parseGhAccounts dedups and preserves first-seen order", () => {
  const text = "account foo (keyring)\naccount bar (keyring)\naccount foo (keyring)";
  expect(parseGhAccounts(text)).toEqual(["foo", "bar"]);
});

test("parseGhAccounts returns [] on empty/unrelated text", () => {
  expect(parseGhAccounts("")).toEqual([]);
  expect(parseGhAccounts("Active account: true\nActive account: false")).toEqual([]);
});

test("getGhAccounts marks the active login and reads status from stdout+stderr", async () => {
  const runGh = vi.fn(async (args: string[]) => {
    if (args[0] === "api") return { stdout: "monalisa\n", stderr: "", code: 0 };
    if (args[0] === "auth") return { stdout: "", stderr: STATUS_SAMPLE, code: 0 };
    return { stdout: "", stderr: "", code: 1 };
  });

  const res = await getGhAccounts(runGh as any);

  expect(res.active).toBe("monalisa");
  expect(res.accounts).toEqual([
    { login: "monalisa", active: true },
    { login: "octocat", active: false },
  ]);
});

test("getGhAccounts returns active:null when the user lookup fails", async () => {
  const runGh = vi.fn(async (args: string[]) => {
    if (args[0] === "api") return { stdout: "", stderr: "not logged in", code: 1 };
    return { stdout: "", stderr: STATUS_SAMPLE, code: 0 };
  });

  const res = await getGhAccounts(runGh as any);

  expect(res.active).toBeNull();
  expect(res.accounts.every((a) => !a.active)).toBe(true);
});

test("switchGhAccount calls `gh auth switch --user <login>` and reports the new active login", async () => {
  const runGh = vi.fn(async () => ({ stdout: "", stderr: "", code: 0 }));

  const res = await switchGhAccount(runGh as any, "octocat");

  expect(runGh).toHaveBeenCalledWith(["auth", "switch", "--user", "octocat"]);
  expect(res).toEqual({ ok: true, active: "octocat" });
});

test("switchGhAccount surfaces stderr on failure", async () => {
  const runGh = vi.fn(async () => ({ stdout: "", stderr: "no such user", code: 1 }));

  const res = await switchGhAccount(runGh as any, "ghost");

  expect(res.ok).toBe(false);
  expect(res.active).toBeNull();
  expect(res.error).toBe("no such user");
});

test("checkRepoAccess is accessible:true with no repo (nothing to check)", async () => {
  const runGh = vi.fn(async () => ({ stdout: "monalisa\n", stderr: "", code: 0 }));

  const res = await checkRepoAccess(runGh as any, null);

  expect(res).toEqual({ accessible: true, repo: null, account: "monalisa" });
});

test("checkRepoAccess reports accessible:false on a 404 (gh api failure)", async () => {
  const runGh = vi.fn(async (args: string[]) => {
    if (args[0] === "api" && args[1] === "user") return { stdout: "monalisa\n", stderr: "", code: 0 };
    return { stdout: "", stderr: "HTTP 404: Not Found", code: 1 };
  });

  const res = await checkRepoAccess(runGh as any, "acme/private-repo");

  expect(res).toEqual({ accessible: false, repo: "acme/private-repo", account: "monalisa" });
});

test("checkRepoAccess reports accessible:true when the repo lookup succeeds", async () => {
  const runGh = vi.fn(async (args: string[]) => {
    if (args[0] === "api" && args[1] === "user") return { stdout: "monalisa\n", stderr: "", code: 0 };
    return { stdout: "acme/web\n", stderr: "", code: 0 };
  });

  const res = await checkRepoAccess(runGh as any, "acme/web");

  expect(res).toEqual({ accessible: true, repo: "acme/web", account: "monalisa" });
});
