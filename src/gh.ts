import { spawn } from "node:child_process";

const PR_FIELDS = "number,title,body,author,baseRefName,headRefName,url,headRefOid";

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
export function ghSubmitReviewArgs(repo: string, number: number): string[] {
  return ["api", "-X", "POST", `repos/${repo}/pulls/${number}/reviews`, "--input", "-"];
}
export function gitDiffArgs(gitRef: string, base?: string): string[] {
  if (gitRef.includes("..")) return ["diff", gitRef];
  return base ? ["diff", `${base}...${gitRef}`] : ["diff", gitRef];
}
export function ghPrChecksJsonArgs(number: number, repo?: string): string[] {
  const a = ["pr", "checks", String(number), "--json", "name,state,bucket,link"];
  return repo ? [...a, "-R", repo] : a;
}
export function ghPrHeadArgs(number: number, repo?: string): string[] {
  const a = ["pr", "view", String(number), "--json", "headRefOid,reviewDecision"];
  return repo ? [...a, "-R", repo] : a;
}
const REVIEW_THREADS_QUERY = `query($owner:String!,$repo:String!,$number:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$number){
    reviewThreads(first:100){ nodes{
      id isResolved isOutdated path line
      comments(first:100){ nodes{ id databaseId author{login} body } } } } } } }`;
export function ghReviewThreadsArgs(owner: string, repo: string, number: number): string[] {
  return ["api", "graphql", "-f", `query=${REVIEW_THREADS_QUERY}`,
    "-f", `owner=${owner}`, "-f", `repo=${repo}`, "-F", `number=${number}`];
}
export function ghReplyThreadArgs(repo: string, number: number, inReplyToCommentId: number): string[] {
  return ["api", "-X", "POST", `repos/${repo}/pulls/${number}/comments/${inReplyToCommentId}/replies`, "--input", "-"];
}
export function ghResolveThreadArgs(threadId: string): string[] {
  return ["api", "graphql", "-f",
    `query=mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}`,
    "-f", `id=${threadId}`];
}
export function ghUnresolveThreadArgs(threadId: string): string[] {
  return ["api", "graphql", "-f",
    `query=mutation($id:ID!){unresolveReviewThread(input:{threadId:$id}){thread{id isResolved}}}`,
    "-f", `id=${threadId}`];
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
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
    if (opts.stdin !== undefined) child.stdin.end(opts.stdin);
    else child.stdin.end();
  });
}

export const runGh = (args: string[], opts?: RunOpts) => run("gh", args, opts);
export const runGit = (args: string[], opts?: RunOpts) => run("git", args, opts);
