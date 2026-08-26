import { memo, useEffect, useMemo, useState } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import type { DraftComment } from "../src/draft";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { ReviewHeader } from "./ReviewHeader";
import { ChapterNav } from "./ChapterNav";
import { DiffViewer } from "./DiffViewer";
import { DraftTray } from "./DraftTray";
import { RereviewBanner } from "./RereviewBanner";
import { ThreadsPanel } from "./ThreadsPanel";

export const ReviewWorkspace = memo(function ReviewWorkspace({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [review, setReview] = useState<any>(null);
  const [guide, setGuide] = useState<any>(null);
  const [patch, setPatch] = useState("");
  const [checks, setChecks] = useState<{ bucket: string; checks: any[] } | null>(null);
  const [activeId, setActiveId] = useState("");
  const [view, setView] = useState<"diff" | "threads">("diff");
  const [repoAccess, setRepoAccess] = useState<{ accessible: boolean; repo: string | null; account: string | null } | null>(null);
  // Draft (pending comments + verdict) is owned here so the inline diff
  // annotations (DiffViewer) and the review tray (DraftTray) always render
  // the same underlying state.
  const [draft, setDraft] = useState<any>({ verdict: "COMMENT", body: "", comments: [] });

  const load = useMemo(
    () => async () => {
      try {
        const [{ review }, { guide }, { patch }, checksRes, { draft }] = await Promise.all([
          rpc.call("getReview", { targetKey }),
          rpc.call("getGuide", { targetKey }),
          rpc.call("getPatch", { targetKey }),
          rpc.call("getChecks", { targetKey }),
          rpc.call("getDraft", { targetKey }),
        ]);
        setReview(review);
        setGuide(guide);
        setPatch(patch);
        setChecks(checksRes);
        setDraft(draft);
        if (guide?.sections?.[0]) setActiveId((prev) => prev || guide.sections[0].id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load review");
      }
    },
    [rpc, targetKey],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime(`review:${targetKey}`, () => {
    void load();
  });

  async function addComment(comment: DraftComment) {
    try {
      const { draft } = await rpc.call("saveDraftComment", { targetKey, comment });
      setDraft(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }
  async function removeComment(index: number) {
    try {
      const { draft } = await rpc.call("removeDraftComment", { targetKey, index });
      setDraft(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

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
  // Re-check after switching GitHub accounts so the banner clears/updates.
  useRealtime("gh-account", () => {
    void checkAccess();
  });

  const activeFiles: string[] = useMemo(() => {
    const s = guide?.sections?.find((x: any) => x.id === activeId);
    return s ? s.diffs.map((d: any) => d.file) : [];
  }, [guide, activeId]);

  if (!guide) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {review?.status === "error" ? "Generation failed. Re-run `bb review`." : "Building the guide…"}
      </div>
    );
  }

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
          <ChapterNav sections={guide.sections} activeId={activeId} onSelect={setActiveId} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <div className="flex items-center gap-0.5 border-b border-border px-3 py-1.5">
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
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {view === "diff" ? (
              <DiffViewer
                patch={patch}
                files={activeFiles}
                draft={draft}
                addComment={addComment}
                removeComment={removeComment}
                activeChapterId={activeId}
              />
            ) : (
              <ThreadsPanel targetKey={targetKey} />
            )}
          </div>
        </main>
      </div>
      <DraftTray
        targetKey={targetKey}
        activeChapterId={activeId}
        activeFiles={activeFiles}
        draft={draft}
        setDraft={setDraft}
        removeComment={removeComment}
      />
    </div>
  );
});
ReviewWorkspace.displayName = "ReviewWorkspace";
