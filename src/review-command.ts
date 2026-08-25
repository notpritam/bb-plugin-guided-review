import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "./store";
import { parseTarget, targetKey } from "./targets";
import { ensureGitHeaders } from "./patch";
import { generateGuide } from "./generate";
import {
  ghPrViewArgs, ghPrDiffArgs, ghRepoViewArgs, gitDiffArgs,
} from "./gh";

interface Deps {
  bb: BbPluginApi;
  store: Store;
  gh: { runGh: typeof import("./gh").runGh; runGit: typeof import("./gh").runGit };
}
interface Ctx { projectId?: string; threadId?: string; cwd?: string }

export async function runReviewCommand(deps: Deps, argv: string[], ctx: Ctx) {
  const positional = argv.filter((a) => !a.startsWith("-"));
  const input = positional[0];
  if (!input) return { exitCode: 2, stderr: "usage: bb review <pr-url | pr-number | git-ref> [--base <ref>]" };
  if (!ctx.projectId) return { exitCode: 2, stderr: "Run `bb review` inside a project thread." };

  const baseIdx = argv.indexOf("--base");
  const base = baseIdx >= 0 ? argv[baseIdx + 1] : undefined;
  const target = parseTarget(input, base);
  const key = targetKey(target);
  const cwd = ctx.cwd;
  const now = Date.now();

  let patch = "";
  const meta: any = { targetKey: key, kind: target.kind, status: "generating", createdAt: now };
  meta.projectId = ctx.projectId;
  meta.cwd = ctx.cwd;

  if (target.kind === "pr") {
    let repo = target.repo;
    if (!repo) {
      const r = await deps.gh.runGh(ghRepoViewArgs(), { cwd });
      if (r.code !== 0) return { exitCode: 1, stderr: ghError(r.stderr) };
      try {
        repo = JSON.parse(r.stdout).nameWithOwner as string;
      } catch {
        return { exitCode: 1, stderr: "Unexpected gh output (could not parse JSON)." };
      }
    }
    const view = await deps.gh.runGh(ghPrViewArgs(target.number, repo), { cwd });
    if (view.code !== 0) return { exitCode: 1, stderr: ghError(view.stderr) };
    let pr: any;
    try {
      pr = JSON.parse(view.stdout);
    } catch {
      return { exitCode: 1, stderr: "Unexpected gh output (could not parse JSON)." };
    }
    Object.assign(meta, {
      number: target.number, repo, title: pr.title, author: pr.author?.login,
      base: pr.baseRefName, head: pr.headRefName, url: pr.url, gitRef: `${pr.baseRefName}...${pr.headRefName}`,
    });
    meta.headSha = pr.headRefOid;
    const diff = await deps.gh.runGh(ghPrDiffArgs(target.number, repo), { cwd });
    if (diff.code !== 0) return { exitCode: 1, stderr: ghError(diff.stderr) };
    patch = diff.stdout;
  } else {
    const diff = await deps.gh.runGit(gitDiffArgs(target.gitRef, target.base), { cwd });
    if (diff.code !== 0) return { exitCode: 1, stderr: diff.stderr || "git diff failed" };
    patch = diff.stdout;
    meta.gitRef = target.base ? `${target.base}...${target.gitRef}` : target.gitRef;
    meta.base = target.base;
  }

  if (!patch.trim()) return { exitCode: 1, stderr: "No changes found for that target." };

  deps.store.saveReview(meta);
  deps.store.savePatch(key, ensureGitHeaders(patch));

  // Fire-and-forget generation; the panel refetches on the realtime signal.
  void generateGuide(deps.bb, deps.store, key, ctx.projectId).catch(() => deps.store.setStatus(key, "error"));

  return {
    exitCode: 0,
    stdout: `Guided Review started for ${key}. Open the Guided Review panel to watch it build and review.`,
  };
}

function ghError(stderr: string): string {
  if (/gh auth login|not logged|authentication|bad credentials|http 401/i.test(stderr)) {
    return "GitHub CLI is not authenticated. Run `gh auth login` (needs `repo` scope), then retry.";
  }
  return stderr || "gh command failed";
}
