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

  const refetch = useCallback(async () => {
    try {
      const r = await rpc.call("getGhAccounts", null);
      setActive(r.active);
      setAccounts(r.accounts);
    } catch {
      // Non-fatal: bar just won't show account info.
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
    <div className="flex w-full items-center gap-2 border-b border-border pb-3 text-sm">
      <span className="text-muted-foreground">GitHub:</span>
      <span className="font-medium text-foreground">{active ? `@${active}` : "not logged in"}</span>
      {others.length > 0 && (
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Switch to:</span>
          {others.map((a) => (
            <Button
              key={a.login}
              variant="outline"
              size="sm"
              disabled={switching !== null}
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
