import { spawn } from "node:child_process";

const PR_FIELDS = "number,title,body,author,baseRefName,headRefName,url";

export function ghPrViewArgs(number: number, repo?: string): string[] {
  const a = ["pr", "view", String(number), "--json", PR_FIELDS];
  return repo ? [...a, "-R", repo] : a;
}
export function ghPrDiffArgs(number: number, repo?: string): string[] {
  const a = ["pr", "diff", String(number)];
  return repo ? [...a, "-R", repo] : a;
}
export function ghRepoViewArgs(): string[] {
  return ["repo", "view", "--json", "nameWithOwner"];
}
export function ghPrCommentsArgs(repo: string, number: number): string[] {
  return ["api", `repos/${repo}/pulls/${number}/comments`];
}
export function ghPrChecksArgs(number: number, repo?: string): string[] {
  const a = ["pr", "checks", String(number)];
  return repo ? [...a, "-R", repo] : a;
}
export function ghSubmitReviewArgs(repo: string, number: number): string[] {
  return ["api", "-X", "POST", `repos/${repo}/pulls/${number}/reviews`, "--input", "-"];
}
export function gitDiffArgs(gitRef: string, base?: string): string[] {
  if (gitRef.includes("..")) return ["diff", gitRef];
  return base ? ["diff", `${base}...${gitRef}`] : ["diff", gitRef];
}

interface RunOpts { cwd?: string; stdin?: string }
interface RunResult { stdout: string; stderr: string; code: number }

function run(bin: string, args: string[], opts: RunOpts = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
}

export const runGh = (args: string[], opts?: RunOpts) => run("gh", args, opts);
export const runGit = (args: string[], opts?: RunOpts) => run("git", args, opts);
