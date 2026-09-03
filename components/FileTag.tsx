import { memo } from "react";
import { cn } from "../lib/utils";
import { classifyFile, type FileCategory } from "../src/classify";

const CATEGORY_STYLE: Record<FileCategory, string> = {
  test: "border-amber-500/30 text-amber-600 dark:text-amber-400",
  generated: "border-border text-muted-foreground",
  lockfile: "border-border text-muted-foreground",
  docs: "border-sky-500/30 text-sky-600 dark:text-sky-400",
  config: "border-border text-muted-foreground",
  code: "",
};

/**
 * A small category pill for a changed file. Ordinary source code renders
 * nothing (no noise); tests / generated / lockfiles render a muted "skip"
 * hint so the reviewer can see what they don't need to read closely.
 */
export const FileTag = memo(function FileTag({ file, className }: { file: string; className?: string }) {
  const c = classifyFile(file);
  if (c.category === "code") return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-1.5 py-0 text-[10px] leading-4",
        CATEGORY_STYLE[c.category],
        className,
      )}
      title={c.skippable ? `${c.label} — low-value to review, safe to skim` : c.label}
    >
      {c.skippable ? `${c.label} · skip` : c.label}
    </span>
  );
});
FileTag.displayName = "FileTag";
