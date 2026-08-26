import { memo, useEffect, useRef, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export const ThreadsPanel = memo(function ThreadsPanel({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [threads, setThreads] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  async function load() {
    try {
      const { threads } = await rpc.call("getReviewThreads", { targetKey });
      if (cancelledRef.current) return;
      setThreads(threads);
      setLoadError(false);
    } catch (err) {
      if (cancelledRef.current) return;
      setLoadError(true);
      toast.error(err instanceof Error ? err.message : "Failed to load review threads");
    } finally {
      if (!cancelledRef.current) setLoaded(true);
    }
  }

  useEffect(() => {
    cancelledRef.current = false;
    void load();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, targetKey]);

  async function reply(thread: any) {
    const body = (drafts[thread.id] ?? "").trim();
    const inReplyTo = thread.comments?.[0]?.databaseId;
    if (!body || inReplyTo == null) return;
    setBusyId(thread.id);
    try {
      const res = await rpc.call("replyToThread", { targetKey, inReplyTo, body });
      if (res.ok) {
        setDrafts((d) => ({ ...d, [thread.id]: "" }));
        await load();
      } else {
        toast.error(res.error ?? "Reply failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleResolve(thread: any) {
    setBusyId(thread.id);
    try {
      const method = thread.isResolved ? "unresolveThread" : "resolveThread";
      const res = await rpc.call(method, { targetKey, threadId: thread.id });
      if (res.ok) {
        await load();
      } else {
        toast.error(res.error ?? "Failed to update thread");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (loaded && loadError) {
    return <p className="p-4 text-sm text-destructive">Couldn't load review threads.</p>;
  }

  if (loaded && threads.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No review threads yet.</p>;
  }

  return (
    <div className="space-y-3">
      {threads.map((t) => (
        <div key={t.id} className="rounded-md border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">
              {t.path ?? "unknown file"}
              {t.line != null ? `:${t.line}` : ""}
            </span>
            {t.isResolved && (
              <span className="rounded-full border border-border px-1.5 text-[10px] uppercase">resolved</span>
            )}
            {t.isOutdated && (
              <span className="rounded-full border border-border px-1.5 text-[10px] uppercase">outdated</span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-6 px-2 text-[10px]"
              disabled={busyId === t.id}
              onClick={() => toggleResolve(t)}
            >
              {t.isResolved ? "Unresolve" : "Resolve"}
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {(t.comments ?? []).map((c: any) => (
              <li key={c.id} className="text-sm text-foreground">
                <span className="font-medium">{c.author}</span>: <span>{c.body}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={drafts[t.id] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
              placeholder="Reply…"
              className="flex-1"
            />
            <Button
              size="sm"
              disabled={busyId === t.id || !(drafts[t.id] ?? "").trim()}
              onClick={() => reply(t)}
            >
              Reply
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
});
ThreadsPanel.displayName = "ThreadsPanel";
