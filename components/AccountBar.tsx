import { memo, useCallback, useEffect, useState } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import { toast } from "sonner";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";

export const AccountBar = memo(function AccountBar() {
  const rpc = useRpc<typeof rpcContract>();
  const [active, setActive] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ login: string; active: boolean }[]>([]);
  const [switching, setSwitching] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await rpc.call("getGhAccounts", null);
      setActive(r.active);
      setAccounts(r.accounts);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [rpc]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useRealtime("gh-account", () => {
    void refetch();
  });

  async function switchTo(login: string) {
    setSwitching(login);
    try {
      const res = await rpc.call("switchGhAccount", { login });
      if (res.ok) toast.success(`Switched to @${res.active}`);
      else toast.error(res.error ?? "Couldn't switch account");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch account");
    } finally {
      setSwitching(null);
    }
  }

  const others = accounts.filter((a) => !a.active);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 border-b border-border pb-3 text-sm">
      <span className="text-muted-foreground">GitHub:</span>
      <span className="font-medium text-foreground" role="status">{loading ? "Checking account…" : failed ? "Account check unavailable" : active ? `@${active}` : "No account connected"}</span>
      {!loading && (failed || !active) && <Button variant="outline" size="sm" onClick={refetch}>Check again</Button>}
      {!loading && !active && <p className="w-full text-xs leading-relaxed text-muted-foreground">Run <code className="font-mono">gh auth login</code> on the BB server to connect GitHub. Local git reviews work without GitHub.</p>}
      {others.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <span className="text-xs text-muted-foreground">Use on this BB server:</span>
          {others.map((a) => (
            <Button
              key={a.login}
              variant="outline"
              size="sm"
              disabled={switching !== null}
              aria-label={`Use @${a.login} on this BB server`}
              onClick={() => switchTo(a.login)}
            >
              {switching === a.login ? "Switching…" : `@${a.login}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
});
AccountBar.displayName = "AccountBar";
