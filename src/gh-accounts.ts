import type { runGh as RunGhFn } from "./gh";

type RunGh = typeof RunGhFn;

// `gh auth status` lines look like:
//   ✓ Logged in to github.com account monalisa (keyring)
//   - Active account: true
// We want the login after "account " but NOT the "Active account: true/false"
// line — that one has a colon right after "account" (no space), so the
// `\s+` right after "account" fails to match it.
const ACCOUNT_RE = /account\s+([A-Za-z0-9-]+)/g;

export function parseGhAccounts(statusText: string): string[] {
  const logins: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  ACCOUNT_RE.lastIndex = 0;
  while ((m = ACCOUNT_RE.exec(statusText))) {
    const login = m[1];
    if (!seen.has(login)) {
      seen.add(login);
      logins.push(login);
    }
  }
  return logins;
}

export async function getGhAccounts(
  runGh: RunGh,
): Promise<{ active: string | null; accounts: { login: string; active: boolean }[] }> {
  const [userRes, statusRes] = await Promise.all([
    runGh(["api", "user", "--jq", ".login"]),
    runGh(["auth", "status", "--hostname", "github.com"]),
  ]);
  const active = userRes.code === 0 ? userRes.stdout.trim() || null : null;
  // gh writes `auth status` output to stderr on some versions, stdout on others.
  const logins = parseGhAccounts(statusRes.stdout + "\n" + statusRes.stderr);
  if (active && !logins.includes(active)) logins.unshift(active);
  const accounts = logins.map((login) => ({ login, active: login === active }));
  return { active, accounts };
}

export async function switchGhAccount(
  runGh: RunGh,
  login: string,
): Promise<{ ok: boolean; active: string | null; error?: string }> {
  if (!/^[A-Za-z0-9-]+$/.test(login)) return { ok: false, active: null, error: "Invalid GitHub login." };
  const r = await runGh(["auth", "switch", "--hostname", "github.com", "--user", login]);
  if (r.code === 0) {
    const actual = await runGh(["api", "user", "--jq", ".login"]);
    const active = actual.code === 0 ? actual.stdout.trim() || null : null;
    if (active?.toLowerCase() === login.toLowerCase()) return { ok: true, active };
    return { ok: false, active, error: "The active GitHub account did not change. Check whether GH_TOKEN or GITHUB_TOKEN overrides the saved account on the BB server." };
  }
  return { ok: false, active: null, error: r.stderr || "switch failed" };
}

export async function checkRepoAccess(
  runGh: RunGh,
  repo: string | null,
): Promise<{ accessible: boolean; repo: string | null; account: string | null }> {
  const userRes = await runGh(["api", "user", "--jq", ".login"]);
  const account = userRes.code === 0 ? userRes.stdout.trim() : null;
  if (!repo) return { accessible: true, repo: null, account };
  const r = await runGh(["api", `repos/${repo}`, "--jq", ".full_name"]);
  return { accessible: r.code === 0, repo, account };
}
