import { memo, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AssistPopover } from "./AssistPopover";

// Draft state (pending comments + verdict) is owned by ReviewWorkspace and
// passed down, so the pending list here always matches the inline bubbles
// rendered by DiffViewer. Adding/removing comments now happens by clicking a
// diff line (DiffViewer's gutter "+" affordance); this tray only lists the
// resulting drafts, lets the reviewer edit verdict/summary, and submits.
export const DraftTray = memo(function DraftTray({
  targetKey,
  activeChapterId,
  activeFiles,
  draft,
  setDraft,
  removeComment,
}: {
  targetKey: string;
  activeChapterId: string;
  activeFiles: string[];
  draft: any;
  setDraft: (draft: any) => void;
  removeComment: (index: number) => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [showNotes, setShowNotes] = useState(false);

  async function submit() {
    try {
      await rpc.call("setVerdict", { targetKey, verdict: draft.verdict, body: draft.body });
      const res = await rpc.call("submitReview", { targetKey });
      if (res.ok) toast.success("Review submitted to GitHub");
      else toast.error(res.error ?? "Submit failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const pendingCount = draft.comments.length;

  return (
    <div className="border-t border-border">
      {/* Persistent slim bar: always visible, one row. */}
      <div className="flex items-center gap-2 p-2">
        {pendingCount > 0 && <span className="text-xs text-muted-foreground">{pendingCount} pending</span>}
        <div className="ml-auto flex items-center gap-2">
          <AssistPopover targetKey={targetKey} chapterId={activeChapterId} file={activeFiles[0]} />
          <Select value={draft.verdict} onValueChange={(v) => setDraft({ ...draft, verdict: v })}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMMENT">Comment</SelectItem>
              <SelectItem value="APPROVE">Approve</SelectItem>
              <SelectItem value="REQUEST_CHANGES">Request changes</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={submit}>
            Submit review
          </Button>
        </div>
      </div>

      {/* Pending comments list: click a diff line to add one. */}
      {pendingCount > 0 && (
        <div className="border-t border-border px-2 py-1.5">
          <ul className="max-h-24 space-y-1 overflow-y-auto text-xs">
            {draft.comments.map((c: any, i: number) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1 text-foreground"
              >
                <span className="shrink-0 text-muted-foreground">
                  {c.file}:{c.line}
                </span>
                <span className="truncate">{c.body}</span>
                <button
                  type="button"
                  className="ml-auto shrink-0 text-destructive"
                  aria-label="Remove comment"
                  onClick={() => removeComment(i)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Review notes disclosure: collapsed by default. */}
      <div className="border-t border-border px-2 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={showNotes}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowNotes((s) => !s)}
          >
            {showNotes ? "− Review notes" : "＋ Review notes"}
          </button>
          {!showNotes && draft.body?.trim() && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{draft.body}</span>
          )}
        </div>
        {showNotes && (
          <Textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder="Review summary (posted as the review body)"
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
});
DraftTray.displayName = "DraftTray";
