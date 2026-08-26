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
    <nav className="space-y-1">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={cn(
            "w-full rounded-md border border-border p-2 text-left",
            s.id === activeId ? "bg-muted" : "bg-card hover:bg-muted",
          )}
        >
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-medium text-foreground">{s.title}</div>
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
          </div>
          <div className="line-clamp-2 text-xs text-muted-foreground">{s.overview}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">{s.diffs.length} file(s)</div>
        </button>
      ))}
    </nav>
  );
});
ChapterNav.displayName = "ChapterNav";
