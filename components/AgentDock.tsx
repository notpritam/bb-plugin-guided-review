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

export interface DockInjection { context: AgentMessageContext; nonce: number; }
export interface AgentDockProps {
  targetKey: string;
  currentFile?: string;
  currentChapterId?: string;
  injection?: DockInjection;
  /** Fullscreen root, so a popped-out widget remains in the visible subtree. */
  container?: HTMLElement | null;
  active?: boolean;
  onDock?: () => void;
  onCollapse?: () => void;
}
interface Persisted { mode: "panel" | "widget"; rect: Rect; }
function bounds() { return { width: window.innerWidth, height: window.innerHeight }; }
function loadPersisted(targetKey: string): Persisted | null {
  try { return JSON.parse(localStorage.getItem(`gr:agentdock:${targetKey}`) ?? "null"); }
  catch { return null; }
}
function contextLabel(context: AgentMessageContext): string {
  if (!context.file) return "whole change";
  const name = context.file.split("/").pop() ?? context.file;
  if (context.startLine == null) return name;
  return `${name}:${context.startLine}${context.endLine != null && context.endLine !== context.startLine ? `–${context.endLine}` : ""}`;
}

// This controller stays mounted when changing tabs or presentation. Its single
// composer, transcript, selection, and pending request survive panel ↔ widget.
export const AgentDock = memo(function AgentDock({ targetKey, currentFile, currentChapterId, injection, container, active = true, onDock, onCollapse }: AgentDockProps) {
  const rpc = useRpc<typeof rpcContract>();
  const scopeProps = usePortalScopeProps();
  const persisted = useMemo(() => loadPersisted(targetKey), [targetKey]);
  const [mode, setMode] = useState<"panel" | "widget">(persisted?.mode === "widget" ? "widget" : "panel");
  const [rect, setRect] = useState<Rect>(() => persisted?.rect && [persisted.rect.x, persisted.rect.y, persisted.rect.w, persisted.rect.h].every(Number.isFinite) ? clampRect(persisted.rect, bounds()) : defaultRect(bounds()));
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [chip, setChip] = useState<AgentMessageContext | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const gestureCleanup = useRef<(() => void) | null>(null);
  const readRevision = useRef(0);
  const visible = active || mode === "widget";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; gestureCleanup.current?.(); };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(`gr:agentdock:${targetKey}`, JSON.stringify({ mode, rect })); } catch { /* optional persistence */ }
  }, [targetKey, mode, rect]);
  useEffect(() => {
    const resize = () => setRect((previous) => clampRect(previous, bounds()));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const refresh = useCallback(async () => {
    const revision = ++readRevision.current;
    try {
      const result = await rpc.call("getAgentMessages", { targetKey });
      if (mounted.current && revision === readRevision.current) { setMessages(result.messages as AgentMessage[]); setLoaded(true); setLoadError(false); }
    } catch { if (mounted.current && revision === readRevision.current) setLoadError(true); }
  }, [rpc, targetKey]);
  useEffect(() => { if (visible) void refresh(); }, [visible, refresh]);
  useRealtime(`agent:${targetKey}`, () => { if (visible) void refresh(); });
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [visible, mode]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, visible, mode]);
  useEffect(() => {
    if (!injection) return;
    setChip(injection.context);
    const frame = requestAnimationFrame(() => composerRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [injection]);

  const effectiveContext = chip ?? (currentFile ? { file: currentFile, chapterId: currentChapterId } : undefined);
  async function send() {
    const message = input.trim();
    if (!message || locked.current) return;
    locked.current = true; setBusy(true); setInput("");
    try {
      const context = effectiveContext && Object.fromEntries(Object.entries(effectiveContext).filter(([, value]) => value !== undefined));
      await rpc.call("askAgent", { targetKey, message, ...(context ? { context } : {}) });
      if (mounted.current) setChip(null);
      // A transcript read failure is shown separately; it must never turn a
      // successful send into a restored draft that could be sent a second time.
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The agent could not answer");
      if (mounted.current) setInput(message);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function dock() { gestureCleanup.current?.(); setMode("panel"); onDock?.(); }
  function startGesture(event: React.PointerEvent, action: "move" | "resize") {
    event.preventDefault(); gestureCleanup.current?.();
    const start = { x: event.clientX, y: event.clientY, rect };
    const move = (event: PointerEvent) => {
      const dx = event.clientX - start.x, dy = event.clientY - start.y;
      setRect(clampRect(action === "move" ? { ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy } : { ...start.rect, w: start.rect.w + dx, h: start.rect.h + dy }, bounds()));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish);
      gestureCleanup.current = null;
    };
    gestureCleanup.current = finish;
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
  }

  const conversation = <>
    <div className={cn("flex shrink-0 items-center gap-2 border-b border-border px-3 py-2", mode === "widget" && "cursor-move")} onPointerDown={mode === "widget" ? (event) => startGesture(event, "move") : undefined}>
      <Icon name="AiContentGenerator01" className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-sm font-medium">Review assistant</span>
      <Button variant="ghost" size="sm" className="ml-auto" aria-label={mode === "widget" ? "Dock in review panel" : "Open assistant as widget"} onPointerDown={(event) => event.stopPropagation()} onClick={mode === "widget" ? dock : () => setMode("widget")}>
        <Icon name={mode === "widget" ? "Minimize2" : "Maximize2"} className="size-3.5" aria-hidden />{mode === "widget" ? "Dock" : "Pop out"}
      </Button>
      {mode === "panel" && onCollapse && <Button variant="ghost" size="icon" className="hidden size-7 text-muted-foreground @min-[1024px]/review:inline-flex" aria-label="Collapse review panel" onClick={onCollapse}><Icon name="X" aria-hidden /></Button>}
    </div>
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" aria-busy={busy}>
      {loadError && <div role="alert" className="space-y-2 text-sm"><p>Couldn’t load the conversation. Your saved messages are still in BB.</p><Button variant="outline" size="sm" onClick={() => void refresh()}>Retry conversation</Button></div>}
      {!loaded && !loadError && <p role="status" className="text-sm text-muted-foreground">Loading conversation…</p>}
      {loaded && !messages.length && <div className="space-y-2 py-4 text-sm leading-relaxed"><p>Ask about this change.</p><p className="text-muted-foreground">Discuss the current file, check a risk, or select lines in the diff for a focused question. Your conversation stays with this review.</p></div>}
      {messages.map((message) => <div key={message.id} className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="font-medium">{message.role === "user" ? "You" : "Assistant"}</span>{message.role === "user" && message.context && <span className="break-all">{contextLabel(message.context)}</span>}</div>
        <p className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed", message.role === "user" && "rounded-md bg-muted px-3 py-2")}>{message.text}</p>
      </div>)}
      {busy && <p role="status" className="text-sm text-muted-foreground">Thinking…</p>}
    </div>
    <div className="shrink-0 space-y-2 border-t border-border p-3">
      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><span className="shrink-0">Context</span><span className="truncate text-foreground">{effectiveContext ? contextLabel(effectiveContext) : "whole change"}</span>{chip && <Button variant="ghost" size="sm" className="h-6 px-1" aria-label="Clear selection context" onClick={() => setChip(null)}><Icon name="X" className="size-3" aria-hidden /></Button>}</div>
      <div className="flex items-end gap-2">
        <Textarea ref={composerRef} aria-label="Ask the agent" disabled={busy} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
        }} placeholder="Ask the agent…" className="max-h-32 min-h-20 flex-1 resize-none text-sm" />
        <Button size="sm" disabled={busy || !input.trim()} onClick={() => void send()} aria-label="Send"><Icon name="ArrowUp" className="size-4" aria-hidden /></Button>
      </div>
      <p className="text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
    </div>
  </>;
  const widget = mode === "widget" && createPortal(<div role="dialog" aria-label="Review agent" {...scopeProps} className="fixed z-[61] flex flex-col overflow-hidden rounded-lg border border-border shadow-2xl" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, backgroundColor: "rgb(from var(--background) r g b / 1)" }}>
    {conversation}
    <div role="separator" tabIndex={0} aria-label="Resize assistant widget" aria-orientation="horizontal" onPointerDown={(event) => startGesture(event, "resize")} onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); setRect((rect) => clampRect({ ...rect, w: rect.w + (event.key === "ArrowRight" ? 20 : event.key === "ArrowLeft" ? -20 : 0), h: rect.h + (event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0) }, bounds()));
    }} className="absolute bottom-0 right-0 size-3 cursor-nwse-resize border-b-2 border-r-2 border-muted-foreground focus-visible:outline focus-visible:outline-ring" />
  </div>, container ?? document.body);
  return <>
    <section aria-label="Review assistant" hidden={!active} className={cn("flex min-h-0 flex-1 flex-col", !active && "hidden")}>
      {mode === "panel" ? conversation : <><div className="hidden h-11 shrink-0 items-center border-b border-border px-3 @min-[1024px]/review:flex"><h2 className="flex-1 text-xs font-medium">Ask agent</h2>{onCollapse && <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Collapse review panel" onClick={onCollapse}><Icon name="X" aria-hidden /></Button>}</div><div className="space-y-3 p-3 text-sm"><p className="text-muted-foreground">The assistant is open as a widget.</p><Button variant="outline" size="sm" onClick={dock}>Dock in review panel</Button></div></>}
    </section>
    {widget}
  </>;
});
AgentDock.displayName = "AgentDock";
