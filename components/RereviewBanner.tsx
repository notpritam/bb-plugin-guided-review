import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export const RereviewBanner = memo(function RereviewBanner({ targetKey }: { targetKey: string }) {
  const rpc = useRpc<typeof rpcContract>();
  const [hasNewCommits, setHasNewCommits] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelledRef = useRef(false);

  const recheck = useCallback(async () => {
    try {
      const r = await rpc.call("checkForUpdates", { targetKey });
      if (!cancelledRef.current) setHasNewCommits(r.hasNewCommits);
    } catch {
      // Non-fatal: staleness check just won't show a banner.
    }
  }, [rpc, targetKey]);

  useEffect(() => {
    cancelledRef.current = false;
    void recheck();
    return () => {
      cancelledRef.current = true;
    };
  }, [recheck]);

  // Re-check on every review update (e.g. after Re-review completes and the
  // guide is rebuilt against the new head) so the banner doesn't stay stale.
  useRealtime(`review:${targetKey}`, () => {
    void recheck();
  });

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
