import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import type { AgentMessage, AgentMessageContext } from "../src/store";
import { cn } from "../lib/utils";
import { usePortalScopeProps } from "../lib/portal-scope";
import { clampRect, defaultRect, type Rect } from "../lib/dock-geometry";
import { Icon } from "./ui/icon";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export interface DockInjection {
  context: AgentMessageContext;
  nonce: number;
}

interface Persisted {
  open: boolean;
  rect: Rect;
}

function loadPersisted(targetKey: string): Persisted | null {
  try {
    const raw = localStorage.getItem(`gr:agentdock:${targetKey}`);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}
function savePersisted(targetKey: string, p: Persisted) {
  try {
    localStorage.setItem(`gr:agentdock:${targetKey}`, JSON.stringify(p));
  } catch {
    // storage unavailable — dock still works, just won't remember position.
  }
}

function bounds() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function contextLabel(c: AgentMessageContext): string {
  if (!c.file) return "whole change";
  const name = c.file.split("/").pop() ?? c.file;
  if (c.startLine != null) {
    const end = c.endLine != null && c.endLine !== c.startLine ? `-${c.endLine}` : "";
    return `${name}:${c.startLine}${end}`;
  }
  return name;
}

export const AgentDock = memo(function AgentDock({
  targetKey,
  currentFile,
  currentChapterId,
  injection,
}: {
  targetKey: string;
  currentFile?: string;
  currentChapterId?: string;
  injection?: DockInjection;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const scopeProps = usePortalScopeProps();
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const persisted = useMemo(() => loadPersisted(targetKey), [targetKey]);
  const [open, setOpen] = useState(persisted?.open ?? false);
  const [rect, setRect] = useState<Rect>(() => persisted?.rect ?? defaultRect(bounds()));
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [chip, setChip] = useState<AgentMessageContext | null>(null);
  const [busy, setBusy] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => savePersisted(targetKey, { open, rect }), [targetKey, open, rect]);

  const refresh = useCallback(() => {
    rpc.call("getAgentMessages", { targetKey }).then((r) => setMessages(r.messages as AgentMessage[]));
  }, [rpc, targetKey]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);
  useRealtime(`agent:${targetKey}`, refresh);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // Highlight-to-ask: a selection was captured elsewhere — open + load it.
  useEffect(() => {
    if (!injection) return;
    setChip(injection.context);
    setOpen(true);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [injection?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveContext: AgentMessageContext | undefined =
    chip ?? (currentFile ? { file: currentFile, chapterId: currentChapterId } : undefined);

  async function send() {
    const message = input.trim();
    if (!message) return;
    setBusy(true);
    setInput("");
    try {
      await rpc.call("askAgent", { targetKey, message, context: effectiveContext });
      setChip(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The agent could not answer");
      setInput(message);
    } finally {
      setBusy(false);
    }
  }

  async function openThread() {
    try {
      await rpc.call("openAgentThread", { targetKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open the thread");
    }
  }

  // Pointer drag/resize, clamped to the viewport.
  function startGesture(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, ...rect };
    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      const next =
        mode === "move"
          ? { ...start, x: start.x + dx, y: start.y + dy }
          : { ...start, w: start.w + dx, h: start.h + dy };
      setRect(clampRect({ x: next.x, y: next.y, w: next.w, h: next.h }, bounds()));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const fab = (
    <button
      type="button"
      aria-label={open ? "Hide review agent" : "Ask the review agent"}
      onClick={() => setOpen((o) => !o)}
      className={cn(
        "fixed bottom-5 right-5 z-[60] flex size-11 items-center justify-center rounded-full border border-border bg-foreground text-background shadow-lg",
        !reducedMotion && "transition-transform hover:scale-105",
      )}
      {...scopeProps}
    >
      <Icon name="AiContentGenerator01" className="size-5" aria-hidden />
    </button>
  );

  const window_ = open && (
    <div
      role="dialog"
      aria-label="Review agent"
      className={cn(
        "fixed z-[61] flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl",
        !reducedMotion && "transition-opacity",
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      {...scopeProps}
    >
      <div
        className="flex cursor-move items-center gap-2 border-b border-border bg-muted/50 px-2.5 py-1.5"
        onPointerDown={(e) => startGesture(e, "move")}
      >
        <Icon name="AiContentGenerator01" className="size-4 text-foreground" aria-hidden />
        <span className="text-xs font-semibold text-foreground">Review agent</span>
        <button
          type="button"
          onClick={openThread}
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-state-hover hover:text-foreground"
          title="Open the underlying thread in bb"
        >
          Open as thread
          <Icon name="ArrowUpRight" className="size-3" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => setOpen(false)}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded p-0.5 text-muted-foreground hover:bg-state-hover hover:text-foreground"
        >
          <Icon name="X" className="size-3.5" aria-hidden />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {messages.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Ask about this change — a chapter, a file, or a selection you highlight in the diff.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-0.5", m.role === "user" ? "items-end" : "items-start")}>
            {m.role === "user" && m.context && (
              <span className="rounded-full bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                {contextLabel(m.context)}
              </span>
            )}
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs",
                m.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && <div className="px-1 text-xs text-muted-foreground">Thinking…</div>}
      </div>

      <div className="border-t border-border p-2">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Context:</span>
          {effectiveContext ? (
            <span className="flex items-center gap-1 rounded-full border border-border px-1.5 py-0 text-[10px] text-foreground">
              {contextLabel(effectiveContext)}
              {chip && (
                <button
                  type="button"
                  aria-label="Clear selection context"
                  onClick={() => setChip(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Icon name="X" className="size-2.5" aria-hidden />
                </button>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">whole change</span>
          )}
        </div>
        <div className="flex items-end gap-1.5">
          <Textarea
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Ask the agent…  (⌘/Ctrl+Enter)"
            className="max-h-28 min-h-[2.25rem] flex-1 resize-none text-xs"
          />
          <Button size="sm" disabled={busy || !input.trim()} onClick={send} aria-label="Send">
            <Icon name="ArrowUp" className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div
        role="separator"
        aria-label="Resize"
        onPointerDown={(e) => startGesture(e, "resize")}
        className="absolute bottom-0 right-0 size-3.5 cursor-nwse-resize"
        style={{ background: "linear-gradient(135deg, transparent 50%, var(--border) 50%)" }}
      />
    </div>
  );

  return createPortal(
    <>
      {fab}
      {window_}
    </>,
    document.body,
  );
});
AgentDock.displayName = "AgentDock";
