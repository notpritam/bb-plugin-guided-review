import { memo, useEffect, useState } from "react";
import { useRpc, useBbNavigate } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AccountBar } from "./AccountBar";

export const ReviewList = memo(function ReviewList() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const [reviews, setReviews] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void rpc.call("listReviews", null).then((r) => setReviews(r.reviews));
  }, [rpc]);

  async function startReview() {
    const value = input.trim();
    if (!value || starting) return;
    setStarting(true);
    try {
      const res = await rpc.call("startReview", { input: value });
      if (res.ok && res.targetKey) {
        setInput("");
        void rpc.call("listReviews", null).then((r) => setReviews(r.reviews));
        navigate.toPluginPanel("review", { subPath: res.targetKey });
      } else {
        toast.error(res.error ?? "Couldn't start review");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start review");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 p-4">
      <AccountBar />
      <h2 className="text-lg font-semibold text-foreground">Guided Reviews</h2>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void startReview();
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a GitHub PR URL to review…"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={starting || !input.trim()}>
          {starting ? "Starting…" : "Review"}
        </Button>
      </form>

      {reviews.length === 0 && (
        <p className="text-sm text-muted-foreground">Run <code>bb review &lt;pr&gt;</code> to start one.</p>
      )}
      {reviews.map((r) => (
        <button
          key={r.targetKey}
          onClick={() => navigate.toPluginPanel("review", { subPath: r.targetKey })}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-3 text-left hover:bg-muted"
        >
          <span className="text-sm text-foreground">{r.title ?? r.gitRef ?? r.targetKey}</span>
          <span className="text-xs text-muted-foreground">{r.status}</span>
        </button>
      ))}
    </div>
  );
});
ReviewList.displayName = "ReviewList";
