import { memo, useMemo, useState } from "react";
import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { splitPatchByFile } from "../src/patch";
import { cn } from "../lib/utils";
import { Icon } from "./ui/icon";
import { FileTag } from "./FileTag";

export interface FileViewFlags {
  viewed: boolean;
  stale: boolean;
}

// NOTE: @pierre/diffs@1.3.6 — `parsePatchFiles` returns `ParsedPatch[]`, each
// with a nested `.files`; `FileDiff`'s prop is `fileDiff` and the theme lives
// under `options: { theme }`. (See the original task-14 note.)
function useTheme() {
  const darkTheme = document.documentElement.dataset.bbCodeThemeDark;
  const lightTheme = document.documentElement.dataset.bbCodeThemeLight;
  return darkTheme && lightTheme ? { dark: darkTheme, light: lightTheme } : undefined;
}

function diffStats(text: string): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) add++;
    else if (line.startsWith("-") && !line.startsWith("---")) del++;
  }
  return { add, del };
}

export const DiffViewer = memo(function DiffViewer({
  patch,
  files,
  views,
  onToggleViewed,
  registerFileEl,
}: {
  patch: string;
  files: string[];
  views: Map<string, FileViewFlags>;
  onToggleViewed: (file: string, viewed: boolean) => void;
  registerFileEl?: (file: string, el: HTMLElement | null) => void;
}) {
  const theme = useTheme();
  const perFile = useMemo(() => {
    return splitPatchByFile(patch)
      .filter((f) => files.includes(f.path))
      .map((f) => ({
        path: f.path,
        stats: diffStats(f.text),
        fileDiff: parsePatchFiles(f.text).flatMap((p) => p.files)[0] ?? null,
      }))
      .filter((f) => f.fileDiff);
  }, [patch, files]);

  // Explicit collapse overrides; when unset a file follows its "viewed" flag.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const isCollapsed = (file: string) => collapsed[file] ?? (views.get(file)?.viewed ?? false);
  const toggleCollapsed = (file: string) => setCollapsed((c) => ({ ...c, [file]: !isCollapsed(file) }));

  function handleToggleViewed(file: string, next: boolean) {
    onToggleViewed(file, next);
    // Checking Viewed collapses the file; unchecking re-expands it.
    setCollapsed((c) => ({ ...c, [file]: next }));
  }

  if (perFile.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes in this chapter.</p>;
  }

  return (
    <div className="space-y-3">
      {perFile.map(({ path, stats, fileDiff }) => {
        const flags = views.get(path);
        const viewed = flags?.viewed ?? false;
        const stale = flags?.stale ?? false;
        const folded = isCollapsed(path);
        return (
          <div
            key={path}
            ref={(el) => registerFileEl?.(path, el)}
            data-file={path}
            className={cn(
              "overflow-hidden rounded-md border border-border",
              viewed && "border-border/60 opacity-70",
            )}
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
              <button
                type="button"
                aria-label={folded ? "Expand file" : "Collapse file"}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-state-hover hover:text-foreground"
                onClick={() => toggleCollapsed(path)}
              >
                <Icon name={folded ? "ArrowRight" : "ArrowDown"} className="size-3.5" aria-hidden />
              </button>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={path}>
                {path}
              </span>
              <FileTag file={path} />
              <span className="shrink-0 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                +{stats.add}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-rose-600 dark:text-rose-400">−{stats.del}</span>
              {stale && (
                <span
                  className="shrink-0 rounded-full border border-amber-500/40 px-1.5 py-0 text-[10px] leading-4 text-amber-600 dark:text-amber-400"
                  title="This file changed since you marked it viewed"
                >
                  changed
                </span>
              )}
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <input
                  type="checkbox"
                  className="size-3.5 accent-foreground"
                  checked={viewed}
                  onChange={(e) => handleToggleViewed(path, e.target.checked)}
                />
                Viewed
              </label>
            </div>
            {!folded && (
              <div className="overflow-x-auto">
                <FileDiff fileDiff={fileDiff!} options={theme ? { theme } : undefined} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
DiffViewer.displayName = "DiffViewer";
