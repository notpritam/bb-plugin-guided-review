import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { ReviewHeader } from "./ReviewHeader";
import { ChapterNav } from "./ChapterNav";
import { DiffViewer, type FileViewFlags } from "./DiffViewer";
import { DraftTray } from "./DraftTray";
import { RereviewBanner } from "./RereviewBanner";
import { ThreadsPanel } from "./ThreadsPanel";
import { AgentDock, type DockInjection } from "./AgentDock";

export const ReviewWorkspace = memo(function ReviewWorkspace({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [review, setReview] = useState<any>(null);
  const [guide, setGuide] = useState<any>(null);
  const [patch, setPatch] = useState("");
  const [checks, setChecks] = useState<{ bucket: string; checks: any[] } | null>(null);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"diff" | "threads">("diff");
  const [repoAccess, setRepoAccess] = useState<{ accessible: boolean; repo: string | null; account: string | null } | null>(null);
  const [views, setViews] = useState<Map<string, FileViewFlags>>(new Map());
  const [injection, setInjection] = useState<DockInjection | undefined>();
  const [currentFile, setCurrentFile] = useState<string | undefined>();
  const [sel, setSel] = useState<{ x: number; y: number; file: string; code: string } | null>(null);

  const fileEls = useRef<Map<string, HTMLElement>>(new Map());
  const pendingScroll = useRef<string | null>(null);
  const scrollBox = useRef<HTMLDivElement>(null);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const loadViews = useCallback(async () => {
    try {
      const { views } = await rpc.call("getFileViews", { targetKey });
      setViews(new Map(views.map((v: any) => [v.file, { viewed: v.viewed, stale: v.stale }])));
    } catch {
      // Non-fatal — the diff just won't show viewed state.
    }
  }, [rpc, targetKey]);

  const load = useMemo(
    () => async () => {
      try {
        const [{ review }, { guide }, { patch }, checksRes] = await Promise.all([
          rpc.call("getReview", { targetKey }),
          rpc.call("getGuide", { targetKey }),
          rpc.call("getPatch", { targetKey }),
          rpc.call("getChecks", { targetKey }),
        ]);
        setReview(review);
        setGuide(guide);
        setPatch(patch);
        setChecks(checksRes);
        if (guide?.sections?.[0]) setActiveId((prev) => prev || guide.sections[0].id);
        void loadViews();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load review");
      }
    },
    [rpc, targetKey, loadViews],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime(`review:${targetKey}`, () => {
    void load();
  });

  const checkAccess = useMemo(
    () => async () => {
      try {
        const r = await rpc.call("checkRepoAccess", { targetKey });
        setRepoAccess(r);
      } catch {
        // Non-fatal: access banner just won't show.
      }
    },
    [rpc, targetKey],
  );

  useEffect(() => {
    if (guide) void checkAccess();
  }, [guide, checkAccess]);
  useRealtime("gh-account", () => {
    void checkAccess();
  });

  const activeFiles: string[] = useMemo(() => {
    const s = guide?.sections?.find((x: any) => x.id === activeId);
    return s ? s.diffs.map((d: any) => d.file) : [];
  }, [guide, activeId]);

  useEffect(() => {
    setCurrentFile(activeFiles[0]);
  }, [activeFiles]);

  const toggleViewed = useCallback(
    (file: string, viewed: boolean) => {
      setViews((prev) => {
        const next = new Map(prev);
        next.set(file, { viewed, stale: false });
        return next;
      });
      rpc
        .call("setFileViewed", { targetKey, file, viewed })
        .then(() => loadViews())
        .catch(() => loadViews());
    },
    [rpc, targetKey, loadViews],
  );

  const markAllViewed = useCallback(() => {
    const todo = activeFiles.filter((f) => !views.get(f)?.viewed);
    for (const f of todo) toggleViewed(f, true);
  }, [activeFiles, views, toggleViewed]);

  const registerFileEl = useCallback((file: string, el: HTMLElement | null) => {
    if (el) fileEls.current.set(file, el);
    else fileEls.current.delete(file);
  }, []);

  const scrollToFile = useCallback(
    (file: string) => {
      const el = fileEls.current.get(file);
      if (el) el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    },
    [reducedMotion],
  );

  const onSelectFile = useCallback(
    (chapterId: string, file: string) => {
      if (chapterId !== activeId) {
        pendingScroll.current = file;
        setActiveId(chapterId);
      } else {
        scrollToFile(file);
      }
      setCurrentFile(file);
    },
    [activeId, scrollToFile],
  );

  // After a chapter switch requested by a file click, scroll once its files render.
  useEffect(() => {
    if (pendingScroll.current && activeFiles.includes(pendingScroll.current)) {
      const f = pendingScroll.current;
      pendingScroll.current = null;
      requestAnimationFrame(() => scrollToFile(f));
    }
  }, [activeFiles, scrollToFile]);

  // Track the file nearest the top of the scroll viewport as the agent's context.
  const onScroll = useCallback(() => {
    const box = scrollBox.current;
    if (!box) return;
    const top = box.getBoundingClientRect().top;
    let best: string | undefined;
    let bestTop = -Infinity;
    for (const [file, el] of fileEls.current) {
      const t = el.getBoundingClientRect().top - top;
      if (t <= 80 && t > bestTop) {
        bestTop = t;
        best = file;
      }
    }
    if (best) setCurrentFile(best);
  }, []);

  // Highlight-to-ask: capture a selection inside a file card.
  const onMouseUp = useCallback(() => {
    const s = window.getSelection();
    const text = s?.toString() ?? "";
    if (!text.trim() || !s || s.rangeCount === 0) {
      setSel(null);
      return;
    }
    const range = s.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
    const fileEl = el?.closest("[data-file]") as HTMLElement | null;
    if (!fileEl) {
      setSel(null);
      return;
    }
    const r = range.getBoundingClientRect();
    setSel({ x: r.left + r.width / 2, y: r.top, file: fileEl.dataset.file!, code: text.slice(0, 4000) });
  }, []);

  function askAboutSelection() {
    if (!sel) return;
    setInjection({ context: { file: sel.file, code: sel.code, chapterId: activeId }, nonce: Date.now() });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  }

  if (!guide) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {review?.status === "error" ? "Generation failed. Re-run `bb review`." : "Building the guide…"}
      </div>
    );
  }

  const viewedCount = activeFiles.filter((f) => views.get(f)?.viewed).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border">
        <div className="p-3">
          <ReviewHeader review={review} checks={checks} intent={guide.intent} />
        </div>
        <RereviewBanner targetKey={targetKey} />
      </div>
      {repoAccess && !repoAccess.accessible && (
        <p className="border-b border-border px-3 py-1 text-xs text-destructive">
          Active GitHub account {repoAccess.account ? `@${repoAccess.account}` : ""} can't access{" "}
          {repoAccess.repo ?? "this repo"} — switch account in the review list.
        </p>
      )}
      {review?.status === "error" && (
        <p className="border-b border-border px-3 py-1 text-xs text-destructive">
          Re-review failed — showing the previous guide. Try again.
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border p-2">
          <ChapterNav
            sections={guide.sections}
            activeId={activeId}
            onSelect={setActiveId}
            views={views}
            onSelectFile={onSelectFile}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={view === "diff"}
                className={cn("h-6 px-2 text-xs", view === "diff" && "bg-muted")}
                onClick={() => setView("diff")}
              >
                Diff
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={view === "threads"}
                className={cn("h-6 px-2 text-xs", view === "threads" && "bg-muted")}
                onClick={() => setView("threads")}
              >
                Threads
              </Button>
            </div>
            {view === "diff" && activeFiles.length > 0 && (
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {viewedCount} / {activeFiles.length} viewed
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={viewedCount === activeFiles.length}
                  onClick={markAllViewed}
                >
                  <Icon name="Check" className="size-3.5" aria-hidden />
                  Mark all
                </Button>
              </div>
            )}
          </div>
          <div ref={scrollBox} onScroll={onScroll} onMouseUp={onMouseUp} className="min-h-0 flex-1 overflow-y-auto p-4">
            {view === "diff" ? (
              <DiffViewer
                patch={patch}
                files={activeFiles}
                views={views}
                onToggleViewed={toggleViewed}
                registerFileEl={registerFileEl}
              />
            ) : (
              <ThreadsPanel targetKey={targetKey} />
            )}
          </div>
        </main>
      </div>
      <DraftTray targetKey={targetKey} activeChapterId={activeId} activeFiles={activeFiles} />

      {sel && (
        <button
          type="button"
          onClick={askAboutSelection}
          className="fixed z-[62] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-border bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg"
          style={{ left: sel.x, top: sel.y - 6 }}
        >
          <Icon name="AiContentGenerator01" className="size-3.5" aria-hidden />
          Ask agent about this
        </button>
      )}

      <AgentDock
        targetKey={targetKey}
        currentFile={currentFile}
        currentChapterId={activeId}
        injection={injection}
      />
    </div>
  );
});
ReviewWorkspace.displayName = "ReviewWorkspace";
