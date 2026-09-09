import { useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";

/** Register before mounting editors; release only after the open request settles. */
export function useReviewSession() {
  const rpc = useRpc<typeof rpcContract>();
  const [clientId, setClientId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let closed = false;
    const id = crypto.randomUUID();
    setClientId(id);
    setReady(false); setError("");
    const opened = rpc.call("setReviewPresence", { clientId: id, open: true });
    void opened.then(() => { if (!closed) setReady(true); }).catch(() => {
      if (!closed) setError("Couldn’t open the review session. The plugin may be updating. Try again.");
    });
    return () => {
      closed = true;
      void opened.catch(() => {}).then(() => rpc.call("setReviewPresence", { clientId: id, open: false })).catch(() => {});
    };
  }, [rpc, attempt]);
  return { clientId, ready, error, retry: () => setAttempt(value => value + 1) };
}
