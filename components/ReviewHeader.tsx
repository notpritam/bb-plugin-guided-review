import { memo } from "react";

export const ReviewHeader = memo(function ReviewHeader({ review }: { review: any }) {
  if (!review) return null;
  return (
    <header className="border-b border-border pb-2">
      <h2 className="text-base font-semibold text-foreground">{review.title ?? review.gitRef ?? review.targetKey}</h2>
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
