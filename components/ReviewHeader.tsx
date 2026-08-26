import { memo } from "react";
import { cn } from "../lib/utils";

const CI_BUCKET_STYLES: Record<string, string> = {
  pass: "text-foreground",
  fail: "text-destructive",
  pending: "text-muted-foreground",
};
const CI_BUCKET_ICON: Record<string, string> = {
  pass: "✓",
  fail: "✗",
  pending: "…",
};

export const ReviewHeader = memo(function ReviewHeader({
  review,
  checks,
}: {
  review: any;
  checks?: { bucket: string; checks: any[] } | null;
}) {
  if (!review) return null;
  const showChecks = !!checks && checks.bucket !== "none";
  return (
    <header className="border-b border-border pb-2">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{review.title ?? review.gitRef ?? review.targetKey}</h2>
        {showChecks && (
          <span
            className={cn("text-xs font-medium", CI_BUCKET_STYLES[checks!.bucket] ?? "text-muted-foreground")}
            title={`CI: ${checks!.bucket}`}
          >
            {CI_BUCKET_ICON[checks!.bucket] ?? "•"} ({checks!.checks.length})
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {review.author ? `@${review.author} · ` : ""}
        {review.base && review.head ? `${review.base} ← ${review.head}` : review.gitRef}
        {" · "}
        {review.status}
      </p>
    </header>
  );
});
ReviewHeader.displayName = "ReviewHeader";
