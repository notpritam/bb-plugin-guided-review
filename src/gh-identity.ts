import type { runGh } from "./gh";

/** Capture a credential for one submission, so a concurrent `gh auth switch`
 * cannot change the author between checking the PR and posting the review.
 * Credentials stay in this server-side closure and never enter RPC or logs. */
export async function bindGhAccount(run: typeof runGh, login: string): Promise<typeof runGh> {
  if (!/^[A-Za-z0-9-]+$/.test(login)) throw new Error("Verify your GitHub account before submitting.");
  const token = await run(["auth", "token", "--hostname", "github.com", "--user", login]);
  if (token.code !== 0 || !token.stdout.trim()) throw new Error("Could not use this GitHub account. Check authentication on the BB server and try again. Your draft has been kept.");
  const authToken = token.stdout.trim();
  const bound: typeof runGh = (args, opts) => run(args, { ...opts, authToken });
  const identity = await bound(["api", "user", "--jq", ".login"]);
  if (identity.code !== 0 || identity.stdout.trim().toLowerCase() !== login.toLowerCase()) {
    throw new Error("The GitHub account changed. Reload the review and verify the account before submitting. Your draft has been kept.");
  }
  return bound;
}
