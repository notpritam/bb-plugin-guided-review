import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "./store";
import { ensureGitHeaders } from "./patch";
import { generateGuide } from "./generate";
import { ghPrDiffArgs, ghPrHeadArgs, gitDiffArgs } from "./gh";
import { getGhAccounts } from "./gh-accounts";
import { describeGhFailure } from "./gh-errors";

interface Deps {
  bb: BbPluginApi; store: Store;
  gh: { runGh: typeof import("./gh").runGh; runGit: typeof import("./gh").runGit };
}

export async function rerunReview(deps: Deps, targetKey: string): Promise<{ ok: boolean; error?: string }> {
  const m = deps.store.getReview(targetKey);
  if (!m || !m.projectId) return { ok: false, error: "Unknown review or missing project." };

  let patch = "";
  if (m.kind === "pr" && m.number) {
    const diff = await deps.gh.runGh(ghPrDiffArgs(m.number, m.repo));
    if (diff.code !== 0) {
      const { active } = await getGhAccounts(deps.gh.runGh);
      return { ok: false, error: describeGhFailure({ stderr: diff.stderr, repo: m.repo, activeAccount: active }) };
    }
    patch = diff.stdout;
    const head = await deps.gh.runGh(ghPrHeadArgs(m.number, m.repo));
    if (head.code === 0) { try { m.headSha = JSON.parse(head.stdout).headRefOid; } catch { /* keep old */ } }
  } else if (m.gitRef) {
    if (!m.cwd) return { ok: false, error: "Local-ref re-review needs the original working dir; re-run `bb review` in the terminal." };
    const diff = await deps.gh.runGit(gitDiffArgs(m.gitRef), { cwd: m.cwd });
    if (diff.code !== 0) return { ok: false, error: diff.stderr || "git diff failed" };
    patch = diff.stdout;
  } else {
    return { ok: false, error: "Review has no re-runnable target." };
  }
  if (!patch.trim()) return { ok: false, error: "No changes found." };

  deps.store.savePatch(targetKey, ensureGitHeaders(patch));
  deps.store.saveReview({ ...m, status: "generating" });
  void generateGuide(deps.bb, deps.store, targetKey, m.projectId).catch(() => deps.store.setStatus(targetKey, "error"));
  return { ok: true };
}
