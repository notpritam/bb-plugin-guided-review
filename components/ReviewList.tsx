import { memo, useEffect, useState } from "react";
import { useRpc, useBbNavigate } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";

export const ReviewList = memo(function ReviewList() {
  const rpc = useRpc<typeof rpcContract>();
  const navigate = useBbNavigate();
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    void rpc.call("listReviews", null).then((r) => setReviews(r.reviews));
  }, [rpc]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2 p-4">
      <h2 className="text-lg font-semibold text-foreground">Guided Reviews</h2>
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
