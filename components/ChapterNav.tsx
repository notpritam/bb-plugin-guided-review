import { memo, useState } from "react";
import { cn } from "../lib/utils";
import { classifyFile } from "../src/classify";
import { Icon } from "./ui/icon";
import { FileTag } from "./FileTag";
import type { FileViewFlags } from "./DiffViewer";

interface Section {
  id: string;
  title: string;
  overview: string;
  diffs: { file: string; summary?: string }[];
  risk?: string;
}

const RISK_STYLES: Record<string, string> = {
  high: "border-destructive/40 text-destructive",
  medium: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  low: "border-border text-muted-foreground",
};
const RISK_LABEL: Record<string, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };

export const ChapterNav = memo(function ChapterNav({
  sections,
  activeId,
  onSelect,
  views,
  onSelectFile,
}: {
  sections: Section[];
  activeId: string;
  onSelect: (id: string) => void;
  views: Map<string, FileViewFlags>;
  onSelectFile: (chapterId: string, file: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isExpanded = (id: string) => expanded[id] ?? id === activeId;

  return (
    <nav className="space-y-1">
      {sections.map((s) => {
        const active = s.id === activeId;
        const open = isExpanded(s.id);
        const skippable = s.diffs.filter((d) => classifyFile(d.file).skippable).length;
        const allSkippable = s.diffs.length > 0 && skippable === s.diffs.length;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-md border-l-2 border-transparent",
              active ? "border-l-foreground/40 bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="flex items-start gap-1 px-2 py-1.5">
              <button
                type="button"
                aria-label={open ? "Collapse chapter" : "Expand chapter"}
                aria-expanded={open}
                className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-state-hover hover:text-foreground"
                onClick={() => setExpanded((e) => ({ ...e, [s.id]: !open }))}
              >
                <Icon name={open ? "ArrowDown" : "ArrowRight"} className="size-3.5" aria-hidden />
              </button>
              <button onClick={() => onSelect(s.id)} className="min-w-0 flex-1 text-left">
                <div className="flex items-start gap-1.5">
                  <div className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground line-clamp-2">
                    {s.title}
                  </div>
                  {s.risk && (
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-full border px-1.5 py-0 text-[10px] leading-4",
                        RISK_STYLES[s.risk] ?? RISK_STYLES.low,
                      )}
                      title={s.overview}
                    >
                      {RISK_LABEL[s.risk] ?? s.risk}
                    </span>
                  )}
                </div>
                {s.overview && (
                  <div className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{s.overview}</div>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span>
                    {s.diffs.length} file{s.diffs.length === 1 ? "" : "s"}
                  </span>
                  {skippable > 0 && <span>· {skippable} skippable</span>}
                  {allSkippable && <span className="italic">· mostly tests — skim</span>}
                </div>
              </button>
            </div>
            {open && s.diffs.length > 0 && (
              <ul className="space-y-0.5 pb-1.5 pl-7 pr-2">
                {s.diffs.map((d) => {
                  const viewed = views.get(d.file)?.viewed ?? false;
                  return (
                    <li key={d.file}>
                      <button
                        type="button"
                        onClick={() => onSelectFile(s.id, d.file)}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-state-hover"
                        title={d.summary ? `${d.file} — ${d.summary}` : d.file}
                      >
                        <Icon
                          name={viewed ? "Check" : "File"}
                          className={cn("size-3 shrink-0", viewed ? "text-emerald-500" : "text-muted-foreground")}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate font-mono text-[11px]",
                            viewed ? "text-muted-foreground line-through" : "text-foreground",
                          )}
                        >
                          {d.file.split("/").pop()}
                        </span>
                        <FileTag file={d.file} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
});
ChapterNav.displayName = "ChapterNav";
