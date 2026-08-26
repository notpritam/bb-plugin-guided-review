import { memo } from "react";
import { cn } from "../lib/utils";

interface Section {
  id: string;
  title: string;
  overview: string;
  diffs: { file: string }[];
  risk?: string;
}

const RISK_STYLES: Record<string, string> = {
  high: "text-destructive border-destructive",
  medium: "text-muted-foreground border-border",
  low: "text-muted-foreground border-border",
};

export const ChapterNav = memo(function ChapterNav({
  sections,
  activeId,
  onSelect,
}: {
  sections: Section[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {sections.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "w-full rounded-md border-l-2 border-transparent px-2 py-1.5 text-left",
              active ? "border-l-foreground/40 bg-muted" : "hover:bg-muted/50",
            )}
          >
            <div className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{s.title}</div>
              {s.risk && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0 text-[10px] uppercase leading-4",
                    RISK_STYLES[s.risk] ?? RISK_STYLES.low,
                  )}
                >
                  {s.risk}
                </span>
              )}
              <span className="shrink-0 text-[10px] text-muted-foreground">{s.diffs.length} file(s)</span>
            </div>
            {active && s.overview && (
              <div className="mt-1 line-clamp-4 text-xs text-muted-foreground">{s.overview}</div>
            )}
          </button>
        );
      })}
    </nav>
  );
});
ChapterNav.displayName = "ChapterNav";
