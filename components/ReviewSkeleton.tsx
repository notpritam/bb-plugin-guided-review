import { memo } from "react";
import { Skeleton } from "./ui/skeleton";
import { Icon } from "./ui/icon";

/**
 * Loading placeholder for the review workspace — mirrors the real layout
 * (header, chapter sidebar, diff column) so the guide "settles in" instead of
 * popping from a bare line of text. Shown while the generation agent authors
 * the guide.
 */
export const ReviewSkeleton = memo(function ReviewSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <Icon name="GitPullRequest" className="size-4 text-muted-foreground" aria-hidden />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-3 w-2/3" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Chapter sidebar */}
        <aside className="w-72 shrink-0 space-y-3 border-r border-border p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4" style={{ width: `${70 - i * 6}%` }} />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </aside>

        {/* Diff column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
          <div className="flex-1 space-y-4 overflow-hidden p-4">
            {Array.from({ length: 3 }).map((_, f) => (
              <div key={f} className="overflow-hidden rounded-md border border-border">
                <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
                  <Icon name="File" className="size-3.5 text-muted-foreground" aria-hidden />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="ml-auto h-3 w-10" />
                </div>
                <div className="space-y-2 p-3">
                  {Array.from({ length: 4 + f }).map((_, l) => (
                    <Skeleton key={l} className="h-3" style={{ width: `${88 - ((l * 13) % 45)}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <div className="flex items-center justify-center gap-2 border-t border-border py-2 text-xs text-muted-foreground">
        <Icon name="Loading" className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        Building the guide…
      </div>
    </div>
  );
});
ReviewSkeleton.displayName = "ReviewSkeleton";

/** Terminal error state when generation failed. */
export const ReviewError = memo(function ReviewError() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Icon name="AlertTriangle" className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Generation failed</p>
        <p className="text-xs text-muted-foreground">
          Re-run <code className="rounded bg-muted px-1 py-0.5">bb review</code> to rebuild the guide.
        </p>
      </div>
    </div>
  );
});
ReviewError.displayName = "ReviewError";
