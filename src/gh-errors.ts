// The plugin shells out to whichever `gh` account is currently ACTIVE. If
// that account isn't a member of the PR's org/repo, every `gh api` call
// against it 404s — GitHub returns 404 (not 403) for repos a token can't
// see, to avoid leaking their existence. A bare "gh: Not Found (HTTP 404)"
// gives the user no clue it's an account problem, so we rewrite those
// signatures into an actionable message pointing at the account switcher.
const ACCESS_DENIED_RE = /not found|http 404|http 403|must have admin|resource not accessible/i;

export function describeGhFailure(opts: { stderr: string; repo?: string; activeAccount?: string | null }): string {
  const stderr = (opts.stderr ?? "").trim();

  if (ACCESS_DENIED_RE.test(stderr)) {
    const who = opts.activeAccount ? `\`${opts.activeAccount}\`` : "The active GitHub account";
    const where = opts.repo ? `\`${opts.repo}\`` : "this repository";
    return `${who} can't access ${where} (or it doesn't exist). Switch to an account with access via the account bar, then retry.`;
  }

  return stderr || "GitHub request failed";
}
