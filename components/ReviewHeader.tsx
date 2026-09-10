import { memo, useState } from "react";
import { reviewState } from "../lib/review-state";
import { cn } from "../lib/utils";

type ChecksSummary = { bucket: string; checks: any[] } | null | undefined;

/** Small one-line CI status pill derived from the checks summary. */
function CiBadge({ checks }: { checks: ChecksSummary }) {
  if (!checks || checks.bucket === "none") return null;
  const pillClass = "inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4";
  if (checks.bucket === "fail") {
    const n = checks.checks.filter((c: any) => c.bucket === "fail").length;
    return (
      <span className={cn(pillClass, "border-destructive text-destructive")} title="CI: failing">
        ✕ {n}
      </span>
    );
  }
  if (checks.bucket === "pending") {
    const n = checks.checks.filter((c: any) => c.bucket === "pending").length;
    return (
      <span className={cn(pillClass, "border-border text-muted-foreground")} title="CI: pending">
        ● {n} pending
      </span>
    );
  }
  return (
    <span className={cn(pillClass, "border-border text-muted-foreground")} title="CI: passing">
      ✓ passing
    </span>
  );
}

const INTENT_TOGGLE_THRESHOLD = 160;

export const ReviewHeader = memo(function ReviewHeader({
  review,
  checks,
  intent,
}: {
  review: any;
  checks?: ChecksSummary;
  intent?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!review) return null;
  const showIntentToggle = !!intent && intent.length > INTENT_TOGGLE_THRESHOLD;

  return (
    <header className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {review.title ?? review.gitRef ?? review.targetKey}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <CiBadge checks={checks} />
          <span className="text-xs font-medium text-muted-foreground">{reviewState(review).label === "Ready" ? null : reviewState(review).label}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {review.author ? `@${review.author} · ` : ""}
        {review.base && review.head ? `${review.base} ← ${review.head}` : review.gitRef}
      </p>
      {intent && (
        <div>
          <p className={cn("text-sm text-foreground", !expanded && "line-clamp-2")}>{intent}</p>
          {showIntentToggle && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}
    </header>
  );
});
ReviewHeader.displayName = "ReviewHeader";
