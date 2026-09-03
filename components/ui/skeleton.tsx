import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// A muted placeholder block with a light sweeping highlight, for loading states.
//
// The sweep's keyframes live in one hoisted <style>: React 19 dedupes styles by
// `href`, so a whole grid of skeletons still emits a single tag. The animation
// is gated behind `prefers-reduced-motion: no-preference`, so a viewer who has
// asked for less motion sees the highlight parked off-screen and the Skeleton
// reads as a plain static muted block. Colours come from theme tokens only
// (`bg-muted`, `via-foreground/10`), so it tracks light and dark automatically.
const SWEEP_CSS = `
@keyframes gr-skeleton-sweep {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@media (prefers-reduced-motion: no-preference) {
  .gr-skeleton-sweep { animation: gr-skeleton-sweep 1.6s ease-in-out infinite; }
}
`;

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden rounded-md bg-muted", className)}
      {...props}
    >
      <style href="gr-skeleton-sweep" precedence="default">
        {SWEEP_CSS}
      </style>
      <div className="gr-skeleton-sweep pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </div>
  );
}
