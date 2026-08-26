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

  // Idle: a bare small/ghost button tucked under the header — no band, no
  // border. Stale: a slim one-line strip with the nudge text alongside it.
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 text-xs",
        hasNewCommits ? "justify-between border-t border-border bg-muted py-1.5" : "justify-end py-1",
      )}
    >
      {hasNewCommits && <p className="text-foreground">New commits on this PR since the guide was built.</p>}
      <Button variant="ghost" size="sm" className="h-6 px-2" disabled={busy} onClick={reReview}>
        {busy ? "Re-reviewing…" : "Re-review"}
      </Button>
    </div>
  );
});
RereviewBanner.displayName = "RereviewBanner";
