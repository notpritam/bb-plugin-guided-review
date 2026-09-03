import { memo, useEffect, useRef, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface CommentPrefill {
  file: string;
  line: number;
  side: "LEFT" | "RIGHT";
  nonce: number;
}

export const DraftTray = memo(function DraftTray({
  targetKey,
  activeChapterId,
  activeFiles,
  prefill,
}: {
  targetKey: string;
  activeChapterId: string;
  activeFiles: string[];
  prefill?: CommentPrefill;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [draft, setDraft] = useState<any>({ verdict: "COMMENT", body: "", comments: [] });
  const [file, setFile] = useState(activeFiles[0] ?? "");
  const [line, setLine] = useState("1");
  const [side, setSide] = useState<"LEFT" | "RIGHT">("RIGHT");
  const [body, setBody] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // A line selection in the diff asked to comment here — open the composer
  // pre-filled with that file / line / side and focus the comment box.
  useEffect(() => {
    if (!prefill) return;
    setShowComposer(true);
    setFile(prefill.file);
    setLine(String(prefill.line));
    setSide(prefill.side);
    requestAnimationFrame(() => bodyRef.current?.focus());
  }, [prefill?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void rpc.call("getDraft", { targetKey }).then((r) => setDraft(r.draft));
  }, [rpc, targetKey]);
  useEffect(() => {
    setFile(activeFiles[0] ?? "");
  }, [activeFiles]);

  const lineNum = Number(line);
  const lineValid = Number.isInteger(lineNum) && lineNum > 0;

  async function addComment() {
    try {
      const { draft } = await rpc.call("saveDraftComment", {
        targetKey,
        comment: { file, line: lineNum, side, chapterId: activeChapterId, body },
      });
      setDraft(draft);
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }
  async function removeComment(i: number) {
    try {
      const { draft } = await rpc.call("removeDraftComment", { targetKey, index: i });
      setDraft(draft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }
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

      {/* Add-comment disclosure: collapsed by default. */}
      <div className="border-t border-border px-2 py-1.5">
        <button
          type="button"
          aria-expanded={showComposer}
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setShowComposer((s) => !s)}
        >
          {showComposer ? "− Add comment" : "＋ Add comment"}
        </button>
        {showComposer && (
          <div className="mt-2 space-y-2">
            {pendingCount > 0 && (
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
            )}
            <div className="flex items-end gap-2">
              <Input value={file} onChange={(e) => setFile(e.target.value)} placeholder="file" className="w-56" />
              <Input
                type="number"
                value={line}
                onChange={(e) => setLine(e.target.value)}
                placeholder="line"
                className="w-16"
              />
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="comment"
                className="flex-1"
              />
              <Button size="sm" disabled={!file || !body || !lineValid} onClick={addComment}>
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

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
