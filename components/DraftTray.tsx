import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import type { Draft, Verdict } from "../src/draft";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Icon } from "./ui/icon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export interface CommentPrefill { file: string; line: number; side: "LEFT" | "RIGHT"; nonce: number; }

export const DraftTray = memo(function DraftTray({ targetKey, activeChapterId, activeFiles, prefill, isLocal = false }: {
  targetKey: string; activeChapterId: string; activeFiles: string[]; prefill?: CommentPrefill; isLocal?: boolean;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [draft, setDraft] = useState<Draft>({ targetKey, verdict: "COMMENT", body: "", comments: [] });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("Draft saved");
  const [file, setFile] = useState(activeFiles[0] ?? "");
  const [line, setLine] = useState("1");
  const [side, setSide] = useState<"LEFT" | "RIGHT">("RIGHT");
  const [body, setBody] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summary = useRef({ verdict: "COMMENT" as Verdict, body: "", revision: 0, dirty: false });

  const enqueue = useCallback(<T,>(operation: () => Promise<T>) => {
    const next = writes.current.catch(() => {}).then(operation);
    writes.current = next;
    return next;
  }, []);

  const flush = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    const current = summary.current;
    if (!current.dirty) return writes.current;
    const { verdict, body, revision } = current;
    current.dirty = false;
    return enqueue(async () => {
      try {
        await rpc.call("setVerdict", { targetKey, verdict, body });
        if (mounted.current && summary.current.revision === revision) setSaved("Draft saved");
      } catch (error) {
        if (summary.current.revision === revision) {
          summary.current.dirty = true;
          if (mounted.current) setSaved("Couldn’t save notes. Try again.");
        }
        throw error;
      }
    });
  }, [enqueue, rpc, targetKey]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const result = await rpc.call("getDraft", { targetKey });
      if (!mounted.current) return;
      const next = result.draft as Draft;
      setDraft(next);
      summary.current = { verdict: next.verdict, body: next.body, revision: 0, dirty: false };
      setLoaded(true);
    } catch {
      if (mounted.current) setLoadError(true);
    }
  }, [rpc, targetKey]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; void flush().catch(() => {}); };
  }, [load, flush]);

  useEffect(() => { setFile(activeFiles[0] ?? ""); }, [activeFiles]);
  useEffect(() => {
    if (!prefill) return;
    setShowComposer(true); setFile(prefill.file); setLine(String(prefill.line)); setSide(prefill.side);
    const frame = requestAnimationFrame(() => bodyRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [prefill]);

  function updateSummary(change: Partial<Pick<Draft, "verdict" | "body">>) {
    setDraft((previous) => ({ ...previous, ...change }));
    summary.current = { ...summary.current, ...change, revision: summary.current.revision + 1, dirty: true };
    setSaved("Saving draft…");
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => { void flush().catch(() => {}); }, 400);
  }

  async function mutate(operation: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await operation(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Couldn’t save the draft. Try again."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  function updateComments(next: Draft) {
    if (mounted.current) setDraft((previous) => ({ ...previous, comments: next.comments }));
  }
  async function addComment() {
    if (!file.trim() || !body.trim() || !Number.isInteger(Number(line)) || Number(line) < 1) return;
    await mutate(async () => {
      const result = await enqueue(() => rpc.call("saveDraftComment", { targetKey, comment: { file, line: Number(line), side, chapterId: activeChapterId, body: body.trim() } }));
      updateComments(result.draft as Draft); setBody("");
    });
  }
  async function removeComment(index: number) {
    await mutate(async () => {
      const result = await enqueue(() => rpc.call("removeDraftComment", { targetKey, index }));
      updateComments(result.draft as Draft);
    });
  }
  async function submit() {
    if (isLocal || !loaded || body.trim()) return;
    await mutate(async () => {
      await flush();
      const result = await enqueue(() => rpc.call("submitReview", { targetKey }));
      if (!result.ok) { toast.error(result.error ?? "Submit failed. Your draft is still here."); return; }
      toast.success("Review submitted to GitHub");
      await load();
      setSaved("Review submitted");
    });
  }

  if (loadError) return <div role="alert" className="flex flex-wrap items-center gap-3 border-t border-border p-3 text-sm"><span>Couldn’t load your draft. Editing is paused to protect it.</span><Button variant="outline" onClick={() => void load()}>Retry draft</Button></div>;
  if (!loaded) return <p role="status" className="border-t border-border p-3 text-sm text-muted-foreground">Loading draft…</p>;

  const hasReview = draft.comments.length > 0 || draft.body.trim().length > 0 || draft.verdict === "APPROVE";
  return (
    <section aria-label="Review draft" className="max-h-[48vh] shrink-0 overflow-y-auto border-t border-border bg-background">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <span className="text-sm font-medium">{draft.comments.length} draft comment{draft.comments.length === 1 ? "" : "s"}</span>
        <span role="status" className="text-xs text-muted-foreground">{saved}</span>
        {saved.startsWith("Couldn’t") && <Button variant="outline" size="sm" onClick={() => void flush().catch(() => {})}>Save again</Button>}
        {!isLocal && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Select disabled={busy} value={draft.verdict} onValueChange={(value) => updateSummary({ verdict: value as Verdict })}>
            <SelectTrigger aria-label="Review verdict" className="h-10 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="COMMENT">Comment</SelectItem><SelectItem value="APPROVE">Approve</SelectItem><SelectItem value="REQUEST_CHANGES">Request changes</SelectItem></SelectContent>
          </Select>
          <Button disabled={busy || !hasReview || !!body.trim()} onClick={() => void submit()}>{busy ? "Saving…" : "Submit to GitHub"}</Button>
        </div>}
      </div>
      <p className="px-3 pb-3 text-xs leading-relaxed text-muted-foreground">{isLocal ? "Local review. Comments and notes stay in this BB installation." : body.trim() ? "Add the comment you’re writing to the draft before submitting." : "Drafts stay in BB until you submit. GitHub actions use this server’s active GitHub CLI account."}</p>
      <div className="border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" aria-expanded={showComposer} onClick={() => setShowComposer((value) => !value)}><Icon name={showComposer ? "ChevronDown" : "Plus"} className="size-4" aria-hidden /> Draft comments</Button>
        {showComposer && <div className="mt-3 space-y-3">
          {draft.comments.length > 0 && <ul className="space-y-2 text-sm">{draft.comments.map((comment, index) => <li key={index} className="flex items-start gap-3 rounded-md border border-border p-3"><div className="min-w-0 flex-1"><p className="break-all text-xs text-muted-foreground">{comment.file}:{comment.line} · {comment.side === "LEFT" ? "Original" : "Changed"}</p><p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p></div><Button variant="ghost" size="sm" disabled={busy} aria-label={`Remove comment on ${comment.file}:${comment.line}`} onClick={() => void removeComment(index)}><Icon name="X" className="size-4" aria-hidden /></Button></li>)}</ul>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_80px_140px]">
            <label className="space-y-1 text-xs text-muted-foreground">File<Input aria-label="Comment file" disabled={busy} value={file} onChange={(event) => setFile(event.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Line<Input aria-label="Comment line" disabled={busy} type="number" min={1} value={line} onChange={(event) => setLine(event.target.value)} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Side<select aria-label="Comment side" disabled={busy} className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground" value={side} onChange={(event) => setSide(event.target.value as "LEFT" | "RIGHT")}><option value="RIGHT">Changed lines</option><option value="LEFT">Original lines</option></select></label>
          </div>
          <Textarea ref={bodyRef} aria-label="Draft comment" disabled={busy} value={body} onChange={(event) => setBody(event.target.value)} placeholder="What should the author know?" />
          <Button disabled={busy || !file.trim() || !body.trim() || !Number.isInteger(Number(line)) || Number(line) < 1} onClick={() => void addComment()}>Add to draft</Button>
        </div>}
      </div>
      <div className="border-t border-border px-3 py-2">
        <Button variant="ghost" size="sm" aria-expanded={showNotes} onClick={() => setShowNotes((value) => !value)}><Icon name={showNotes ? "ChevronDown" : "Plus"} className="size-4" aria-hidden /> Review notes</Button>
        {showNotes ? <Textarea aria-label="Review summary" disabled={busy} value={draft.body} onChange={(event) => updateSummary({ body: event.target.value })} onBlur={() => void flush().catch(() => {})} placeholder={isLocal ? "Notes for this local review" : "Summary to include with your GitHub review"} className="mt-2" /> : draft.body.trim() && <p className="mt-1 truncate text-sm text-muted-foreground">{draft.body}</p>}
      </div>
    </section>
  );
});
DraftTray.displayName = "DraftTray";
