import { memo, useEffect, useMemo, useState } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";
import { ReviewHeader } from "./ReviewHeader";
import { ChapterNav } from "./ChapterNav";
import { DiffViewer } from "./DiffViewer";
import { DraftTray } from "./DraftTray";

export const ReviewWorkspace = memo(function ReviewWorkspace({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [review, setReview] = useState<any>(null);
  const [guide, setGuide] = useState<any>(null);
  const [patch, setPatch] = useState("");
  const [activeId, setActiveId] = useState("");

  const load = useMemo(
    () => async () => {
      const [{ review }, { guide }, { patch }] = await Promise.all([
        rpc.call("getReview", { targetKey }),
        rpc.call("getGuide", { targetKey }),
        rpc.call("getPatch", { targetKey }),
      ]);
      setReview(review);
      setGuide(guide);
      setPatch(patch);
      if (guide?.sections?.[0]) setActiveId((prev) => prev || guide.sections[0].id);
    },
    [rpc, targetKey],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime(`review:${targetKey}`, () => {
    void load();
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
      <div className="border-b border-border p-3">
        <ReviewHeader review={review} />
        <p className="mt-1 text-sm text-foreground">{guide.intent}</p>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border p-3">
          <ChapterNav sections={guide.sections} activeId={activeId} onSelect={setActiveId} />
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <DiffViewer patch={patch} files={activeFiles} />
        </main>
      </div>
      <DraftTray targetKey={targetKey} activeChapterId={activeId} activeFiles={activeFiles} />
    </div>
  );
});
ReviewWorkspace.displayName = "ReviewWorkspace";
