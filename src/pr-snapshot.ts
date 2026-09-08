import { ghErrorMessage, ghPrViewArgs, ghPrDiffArgs, ghPrHeadArgs, type runGh } from "./gh";

/** Read a diff only when both surrounding head checks identify the same revision. */
export async function readPrSnapshot(run: typeof runGh, number: number, repo: string, cwd?: string) {
  const view = await run(ghPrViewArgs(number, repo), { cwd });
  if (view.code !== 0) throw new Error(ghErrorMessage(view));
  let pr: { title: string; author?: { login?: string }; baseRefName: string; headRefName: string; url: string; headRefOid: string };
  try {
    pr = JSON.parse(view.stdout);
    if (!pr || typeof pr.headRefOid !== "string" || !pr.headRefOid || typeof pr.title !== "string" || typeof pr.baseRefName !== "string" || typeof pr.headRefName !== "string") throw new Error();
  } catch {
    throw new Error("Unexpected gh PR output. Could not identify the revision to review.");
  }
  const diff = await run(ghPrDiffArgs(number, repo), { cwd });
  if (diff.code !== 0) throw new Error(ghErrorMessage(diff));
  const head = await run(ghPrHeadArgs(number, repo), { cwd });
  if (head.code !== 0) throw new Error(ghErrorMessage(head));
  let current: unknown;
  try { current = JSON.parse(head.stdout)?.headRefOid; } catch { /* reject below */ }
  if (current !== pr.headRefOid) throw new Error("The PR changed while its diff was loading. Retry to review the latest revision.");
  if (!diff.stdout.trim()) throw new Error("No changes found for that PR.");
  return { pr, patch: diff.stdout };
}
