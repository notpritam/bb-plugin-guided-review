import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "./store";
import { parseTarget, targetKey } from "./targets";
import { ensureGitHeaders } from "./patch";
import { generateGuide } from "./generate";
import { ghPrViewArgs, ghPrDiffArgs } from "./gh";
import { getGhAccounts } from "./gh-accounts";
import { describeGhFailure } from "./gh-errors";

interface Deps {
  bb: BbPluginApi;
  store: Store;
  gh: { runGh: typeof import("./gh").runGh; runGit: typeof import("./gh").runGit };
}

// Panel-driven counterpart to review-command.ts's PR branch: a user pastes a
// full GitHub PR URL into the panel instead of running `bb review` in a
// terminal. Only full PR URLs are accepted here — a bare PR number or local
// git ref needs a project-scoped cwd/branch that the nav panel doesn't have,
// so those still route through the CLI.
export async function createPrReview(
  deps: Deps,
  args: { input: string; projectId: string },
): Promise<{ ok: boolean; error?: string; targetKey?: string }> {
  const target = parseTarget(args.input);
  if (target.kind !== "pr" || !target.repo) {
    return {
      ok: false,
      error:
        "Paste a full GitHub PR URL (github.com/owner/repo/pull/N). For a PR number or local ref, run `bb review` in a terminal.",
    };
  }

  const view = await deps.gh.runGh(ghPrViewArgs(target.number, target.repo));
  if (view.code !== 0) return { ok: false, error: await ghError(deps, view.stderr, target.repo) };
  let pr: any;
  try {
    pr = JSON.parse(view.stdout);
  } catch {
    return { ok: false, error: "Unexpected gh output (could not parse JSON)." };
  }

  const diff = await deps.gh.runGh(ghPrDiffArgs(target.number, target.repo));
  if (diff.code !== 0) return { ok: false, error: await ghError(deps, diff.stderr, target.repo) };
  if (!diff.stdout.trim()) return { ok: false, error: "No changes found for that PR." };

  const key = targetKey(target);
  const now = Date.now();

  deps.store.saveReview({
    targetKey: key,
    kind: "pr",
    number: target.number,
    repo: target.repo,
    title: pr.title,
    author: pr.author?.login,
    base: pr.baseRefName,
    head: pr.headRefName,
    url: pr.url,
    gitRef: `${pr.baseRefName}...${pr.headRefName}`,
    headSha: pr.headRefOid,
    projectId: args.projectId,
    status: "generating",
    createdAt: now,
  });
  deps.store.savePatch(key, ensureGitHeaders(diff.stdout));

  // Fire-and-forget generation; the panel refetches on the realtime signal.
  void generateGuide(deps.bb, deps.store, key, args.projectId).catch(() => deps.store.setStatus(key, "error"));

  return { ok: true, targetKey: key };
}

async function ghError(deps: Deps, stderr: string, repo?: string): Promise<string> {
  if (/gh auth login|not logged|authentication|bad credentials|http 401/i.test(stderr)) {
    return "GitHub CLI is not authenticated. Run `gh auth login` (needs `repo` scope), then retry.";
  }
  const { active } = await getGhAccounts(deps.gh.runGh);
  return describeGhFailure({ stderr, repo, activeAccount: active });
}
