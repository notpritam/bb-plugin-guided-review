import { memo, useEffect, useMemo, useState } from "react";
import { useRpc, useBbNavigate } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { getLastReview } from "../lib/panel-state";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Icon } from "./ui/icon";
import { Skeleton } from "./ui/skeleton";
import { AccountBar } from "./AccountBar";

type ReviewItem = {
  targetKey: string;
  kind?: "pr" | "ref";
  number?: number;
  repo?: string;
  title?: string;
  author?: string;
  base?: string;
  head?: string;
  gitRef?: string;
  url?: string;
  status?: "generating" | "ready" | "error";
  createdAt?: number;
};

/** Compact "2h ago" relative time. Returns null for absent/implausible stamps. */
function timeAgo(ts?: number): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 1_000_000_000_000) return null;
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function isPrReview(r: ReviewItem): boolean {
  return r.kind === "pr" || r.number != null;
}

function KindChip({ isPr, className }: { isPr: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-inset ring-border",
        isPr
          ? "from-violet-500/15 to-sky-500/15 text-violet-600 dark:text-violet-300"
          : "from-amber-500/15 to-emerald-500/15 text-amber-600 dark:text-amber-300",
        className,
      )}
    >
      <Icon name={isPr ? "GitPullRequest" : "GitBranch"} className="size-4" aria-hidden />
    </span>
  );
}

function StatusPill({ status }: { status?: string }) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (status === "generating") {
    return (
      <span className={cn(base, "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
        <Icon name="Loading" className="size-3 animate-spin motion-reduce:animate-none" aria-hidden />
        Generating
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={cn(base, "border-destructive/30 bg-destructive/10 text-destructive")}>
        <Icon name="CircleX" className="size-3" aria-hidden />
        Failed
      </span>
    );
  }
  return (
    <span className={cn(base, "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
      <Icon name="Check" className="size-3" aria-hidden />
      Ready
    </span>
  );
}

function ReviewCard({ review, onOpen }: { review: ReviewItem; onOpen: () => void }) {
  const isPr = isPrReview(review);
  const title = review.title ?? review.gitRef ?? review.targetKey;
  const meta = isPr
    ? [review.repo, review.number != null ? `#${review.number}` : null].filter(Boolean).join(" ") ||
      review.targetKey
    : review.gitRef ?? (review.base && review.head ? `${review.base}…${review.head}` : review.targetKey);
  const when = timeAgo(review.createdAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <KindChip isPr={isPr} className="size-9" />
        <StatusPill status={review.status} />
      </div>

      <div className="min-w-0 space-y-1.5">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{title}</h3>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name={isPr ? "FolderGit" : "GitBranch"} className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{meta}</span>
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          {review.author && (
            <span className="flex min-w-0 items-center gap-1">
              <Icon name="UserRound" className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">@{review.author}</span>
            </span>
          )}
          {when && (
            <span className="flex items-center gap-1">
              {review.author && (
                <span aria-hidden className="text-border">
                  •
                </span>
              )}
              <Icon name="Clock" className="size-3.5 shrink-0" aria-hidden />
              {when}
            </span>
          )}
        </span>
        <Icon
          name="ArrowUpRight"
          className="size-4 shrink-0 text-muted-foreground/40 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
          aria-hidden
        />
      </div>
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="size-9 rounded-lg" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-4 rounded" />
      </div>
    </div>
  );
}

export const ReviewList = memo(function ReviewList() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    rpc
      .call("listReviews", null)
      .then((r) => {
        if (!cancelled) setReviews(r.reviews as ReviewItem[]);
      })
      .catch(() => {
        // Non-fatal: the empty state stands in for a failed list fetch.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rpc]);

  const sorted = useMemo(
    () => [...reviews].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [reviews],
  );

  const lastReview = useMemo(() => {
    try {
      const last = getLastReview();
      if (!last) return null;
      return reviews.find((r) => r.targetKey === last.targetKey) ?? null;
    } catch {
      return null;
    }
  }, [reviews]);

  function open(targetKey: string) {
    navigate.toPluginPanel("review", { subPath: targetKey });
  }

  async function startReview() {
    const value = input.trim();
    if (!value || starting) return;
    setStarting(true);
    try {
      const res = await rpc.call("startReview", { input: value });
      if (res.ok && res.targetKey) {
        setInput("");
        void rpc.call("listReviews", null).then((r) => setReviews(r.reviews as ReviewItem[]));
        open(res.targetKey);
      } else {
        toast.error(res.error ?? "Couldn't start review");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start review");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <AccountBar />

      {/* Hero: title + the PR command bar as the primary action. */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-sky-500/5 to-transparent"
        />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 text-violet-600 ring-1 ring-inset ring-border dark:text-violet-300">
              <Icon name="GitPullRequest" className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Guided Review
              </h1>
              <p className="text-sm text-muted-foreground">
                Turn a pull request into a chaptered walkthrough you can read and reply to.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void startReview();
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Icon
                  name="GitPullRequest"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste a GitHub PR URL to review…"
                  aria-label="GitHub PR URL"
                  className="h-11 pl-9 text-sm"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={starting || !input.trim()}
                className="h-11 shrink-0 gap-2"
              >
                {starting ? (
                  <>
                    <Icon name="Loading" className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                    Starting
                  </>
                ) : (
                  <>
                    <Icon name="AiContentGenerator01" className="size-4" aria-hidden />
                    Review
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="Terminal" className="size-3.5 shrink-0" aria-hidden />
              <span>
                or run{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  bb review &lt;pr&gt;
                </code>{" "}
                in a terminal
              </span>
            </p>
          </form>
        </div>
      </section>

      {/* Resume the most recently opened review, when it's still in the list. */}
      {!loading && lastReview && (
        <button
          type="button"
          onClick={() => open(lastReview.targetKey)}
          className="group flex w-full items-center gap-3 rounded-xl border border-border bg-gradient-to-r from-sky-500/10 via-card to-card p-3 text-left transition hover:border-foreground/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <Icon name="Play" className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Resume where you left off</span>
            <span className="block truncate text-sm font-medium text-foreground">
              {lastReview.title ?? lastReview.gitRef ?? lastReview.targetKey}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition group-hover:bg-foreground/90">
            Resume
            <Icon name="ArrowRight" className="size-3.5" aria-hidden />
          </span>
        </button>
      )}

      {/* Reviews grid / loading / empty. */}
      {loading ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon name="Layers" className="size-4 text-muted-foreground" aria-hidden />
            Reviews
          </h2>
          <div
            role="status"
            aria-busy="true"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <span className="sr-only">Loading reviews…</span>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>
      ) : sorted.length === 0 ? (
        <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-sky-500/15 text-violet-600 ring-1 ring-inset ring-border dark:text-violet-300">
            <Icon name="GitPullRequest" className="size-6" aria-hidden />
          </span>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-foreground">No reviews yet</h3>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Paste a pull request URL above to generate your first guided review, or start one
              from a terminal.
            </p>
          </div>
          <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs text-foreground">
            bb review &lt;pr&gt;
          </code>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon name="Layers" className="size-4 text-muted-foreground" aria-hidden />
            Reviews
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
              {sorted.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((r) => (
              <ReviewCard key={r.targetKey} review={r} onOpen={() => open(r.targetKey)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
ReviewList.displayName = "ReviewList";
