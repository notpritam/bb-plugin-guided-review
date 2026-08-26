import { memo, useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export const RereviewBanner = memo(function RereviewBanner({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [hasNewCommits, setHasNewCommits] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await rpc.call("checkForUpdates", { targetKey });
        if (!cancelled) setHasNewCommits(r.hasNewCommits);
      } catch {
        // Non-fatal: staleness check just won't show a banner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rpc, targetKey]);

  async function reReview() {
    setBusy(true);
    try {
      const res = await rpc.call("rereview", { targetKey });
      if (res.ok) toast.success("Re-review started");
      else toast.error(res.error ?? "Re-review failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border px-3 py-2",
        hasNewCommits ? "justify-between bg-muted" : "justify-end",
      )}
    >
      {hasNewCommits && (
        <p className="text-xs text-foreground">New commits on this PR since the guide was built.</p>
      )}
      <Button variant="outline" size="sm" disabled={busy} onClick={reReview}>
        {busy ? "Re-reviewing…" : "Re-review"}
      </Button>
    </div>
  );
});
RereviewBanner.displayName = "RereviewBanner";
