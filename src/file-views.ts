import { splitPatchByFile } from "./patch";
import { hashFileDiff } from "./diff-hash";
import type { FileView } from "./store";

export interface FileViewState {
  file: string;
  /** Marked viewed AND the file's diff is unchanged since. */
  viewed: boolean;
  /** Was marked viewed but the diff changed since (re-review moved it). */
  stale: boolean;
}

/** Current content hash of every changed file in the patch, keyed by path. */
export function currentFileHashes(patch: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of splitPatchByFile(patch)) if (f.path) m.set(f.path, hashFileDiff(f.text));
  return m;
}

/** Hash of a single file's current diff, or null if it's not in the patch. */
export function hashForFile(patch: string, file: string): string | null {
  return currentFileHashes(patch).get(file) ?? null;
}

/** Resolve stored view rows against the current patch into viewed/stale flags. */
export function computeFileViewState(stored: FileView[], patch: string): FileViewState[] {
  const current = currentFileHashes(patch);
  return stored.map((v) => {
    const cur = current.get(v.file);
    return { file: v.file, viewed: cur != null && cur === v.hash, stale: cur != null && cur !== v.hash };
  });
}
