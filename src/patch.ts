export interface PatchFile { path: string; text: string }

// Add "diff --git a/<p> b/<p>" before each "--- a/<p>" block that lacks one.
export function ensureGitHeaders(patch: string): string {
  const lines = patch.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const minus = line.match(/^--- a\/(.+)$/);
    const prev = out[out.length - 1] ?? "";
    if (minus && !prev.startsWith("diff --git ")) {
      const p = minus[1];
      out.push(`diff --git a/${p} b/${p}`);
    }
    out.push(line);
  }
  return out.join("\n");
}

export function splitPatchByFile(patch: string): PatchFile[] {
  const normalized = ensureGitHeaders(patch);
  const chunks = normalized.split(/\n(?=diff --git )/g).filter((c) => c.startsWith("diff --git "));
  return chunks.map((text) => {
    const m = text.match(/^diff --git a\/(.+?) b\//);
    return { path: m ? m[1] : "", text: text.endsWith("\n") ? text : text + "\n" };
  });
}

export function changedFiles(patch: string): string[] {
  return splitPatchByFile(patch).map((f) => f.path).filter(Boolean);
}
