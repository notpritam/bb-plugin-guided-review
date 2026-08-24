export interface PatchFile { path: string; text: string }

// Ensure each file block has a "diff --git a/<p> b/<p>" header. Real git/gh
// diffs already have one (with an `index ...` line before `--- a/...`); only
// header-less inputs need synthesis. Track presence per file block, not by the
// single previous output line.
export function ensureGitHeaders(patch: string): string {
  const lines = patch.split("\n");
  const out: string[] = [];
  let hasHeader = false;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      hasHeader = true;
      out.push(line);
      continue;
    }
    const minus = line.match(/^--- a\/(.+?)\r?$/); // old-file marker, CRLF-tolerant
    if (minus) {
      if (!hasHeader) out.push(`diff --git a/${minus[1]} b/${minus[1]}`);
      out.push(line);
      hasHeader = false; // next file block starts fresh
      continue;
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
