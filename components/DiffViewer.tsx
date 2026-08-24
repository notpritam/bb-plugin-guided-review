import { memo, useMemo } from "react";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { splitPatchByFile } from "../src/patch";

// NOTE: the task-14 brief's provisional code assumed `parsePatchFiles(scoped)`
// returns an array of file-diff objects directly, and that `FileDiff` accepts
// `file`/`theme` top-level props. The real @pierre/diffs@1.3.6 API (verified
// against node_modules/@pierre/diffs/dist/**/*.d.ts) differs:
//  - `parsePatchFiles` returns `ParsedPatch[]`, each with a nested
//    `.files: FileDiffMetadata[]` — flatten before rendering.
//  - `FileDiff`'s file prop is named `fileDiff`, and theme is nested under
//    `options: { theme }` (there is no top-level `theme` prop).
export const DiffViewer = memo(function DiffViewer({ patch, files }: { patch: string; files: string[] }) {
  const parsedFiles = useMemo(() => {
    const scoped = splitPatchByFile(patch)
      .filter((f) => files.includes(f.path))
      .map((f) => f.text)
      .join("\n");
    if (!scoped.trim()) return [];
    return parsePatchFiles(scoped).flatMap((p) => p.files);
  }, [patch, files]);

  const darkTheme = document.documentElement.dataset.bbCodeThemeDark;
  const lightTheme = document.documentElement.dataset.bbCodeThemeLight;
  const theme = darkTheme && lightTheme ? { dark: darkTheme, light: lightTheme } : undefined;

  if (parsedFiles.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes in this chapter.</p>;
  }

  return (
    <div className="space-y-4">
      {parsedFiles.map((fileDiff, i) => (
        <FileDiff key={fileDiff.name ?? i} fileDiff={fileDiff} options={theme ? { theme } : undefined} />
      ))}
    </div>
  );
});
DiffViewer.displayName = "DiffViewer";
