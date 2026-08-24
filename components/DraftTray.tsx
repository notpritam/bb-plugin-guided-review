import { memo, useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { AssistPopover } from "./AssistPopover";

export const DraftTray = memo(function DraftTray({
  targetKey,
  activeChapterId,
  activeFiles,
}: {
  targetKey: string;
  activeChapterId: string;
  activeFiles: string[];
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [draft, setDraft] = useState<any>({ verdict: "COMMENT", body: "", comments: [] });
  const [file, setFile] = useState(activeFiles[0] ?? "");
  const [line, setLine] = useState("1");
  const [body, setBody] = useState("");

  useEffect(() => {
    void rpc.call("getDraft", { targetKey }).then((r) => setDraft(r.draft));
  }, [rpc, targetKey]);
  useEffect(() => {
    setFile(activeFiles[0] ?? "");
  }, [activeFiles]);

  async function addComment() {
    const { draft } = await rpc.call("saveDraftComment", {
      targetKey,
      comment: { file, line: Number(line), side: "RIGHT", chapterId: activeChapterId, body },
    });
    setDraft(draft);
    setBody("");
  }
  async function removeComment(i: number) {
    const { draft } = await rpc.call("removeDraftComment", { targetKey, index: i });
    setDraft(draft);
  }
  async function submit() {
    await rpc.call("setVerdict", { targetKey, verdict: draft.verdict, body: draft.body });
    const res = await rpc.call("submitReview", { targetKey });
    if (res.ok) toast.success("Review submitted to GitHub");
    else toast.error(res.error ?? "Submit failed");
  }

  return (
    <div className="border-t border-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{draft.comments.length} pending comment(s)</span>
        <div className="ml-auto flex items-center gap-2">
          <AssistPopover targetKey={targetKey} chapterId={activeChapterId} file={file} />
          <Select value={draft.verdict} onValueChange={(v) => setDraft({ ...draft, verdict: v })}>
            <SelectTrigger className="w-40">
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

      <ul className="max-h-24 overflow-y-auto text-xs">
        {draft.comments.map((c: any, i: number) => (
          <li key={i} className="flex items-center gap-2 text-foreground">
            <span className="text-muted-foreground">
              {c.file}:{c.line}
            </span>
            <span className="truncate">{c.body}</span>
            <button className="ml-auto text-destructive" onClick={() => removeComment(i)}>
              remove
            </button>
          </li>
        ))}
      </ul>

      <div className="flex items-end gap-2">
        <Input value={file} onChange={(e) => setFile(e.target.value)} placeholder="file" className="w-64" />
        <Input value={line} onChange={(e) => setLine(e.target.value)} placeholder="line" className="w-20" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="comment" className="flex-1" />
        <Button size="sm" disabled={!file || !body} onClick={addComment}>
          Add
        </Button>
      </div>

      <Textarea
        value={draft.body}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        placeholder="Review summary (posted as the review body)"
      />
    </div>
  );
});
DraftTray.displayName = "DraftTray";
