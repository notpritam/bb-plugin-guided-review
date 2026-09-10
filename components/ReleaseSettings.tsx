import { useEffect, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";
import type { ReleaseStatus } from "../src/plugin-updates";
import { Button } from "./ui/button";

const descriptions: Record<ReleaseStatus["outcome"], string> = {
  unchecked: "Check for a compatible release.",
  current: "You’re on the latest compatible release.",
  "update-available": "A compatible release is available.",
  incompatible: "A newer release needs a newer BB or Node version. Update your BB server, then check again.",
  pinned: "This is a local or pinned installation. Marketplace installations can follow compatible releases.",
  unavailable: "Updates could not be resolved. Check your connection and try again.",
};

export function ReleaseSettings({ clientId, disabled, onUpdatingChange }: { clientId: string; disabled: boolean; onUpdatingChange?: (updating: boolean) => void }) {
  const rpc = useRpc<typeof rpcContract>();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void rpc.call("getReleaseStatus", null).then(setStatus).catch(() => setError("Couldn’t load update settings. Check again.")); }, [rpc]);
  async function perform(action: "check" | "update" | "toggle") {
    if (busy) return;
    setBusy(action); setError(""); setMessage("");
    if (action === "update") onUpdatingChange?.(true);
    try {
      if (action === "check") setStatus(await rpc.call("checkPluginUpdates", null));
      else if (action === "toggle" && status) setStatus(await rpc.call("setAutomaticUpdates", { enabled: !status.automatic }));
      else if (status?.candidateVersion) {
        const result = await rpc.call("applyPluginUpdate", { clientId, candidateVersion: status.candidateVersion });
        if (result.outcome === "rolled-back") setError("The update failed and BB restored the previous version. Check for updates before retrying.");
        else { setMessage(result.outcome === "updated" ? `Updated${result.version ? ` to ${result.version}` : ""}. Reopen Guided Review to load it.` : "Already on the latest compatible release."); await rpc.call("getReleaseStatus", null).then(setStatus).catch(() => {}); }
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn’t complete the update. Your reviews stay saved in BB."); }
    finally { setBusy(""); if (action === "update") onUpdatingChange?.(false); }
  }
  return <section aria-label="Plugin updates" className="space-y-4 border-t border-border pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Plugin updates</h2>{status && <span className="font-mono text-xs text-muted-foreground">v{status.installedVersion}</span>}</div>
    {status && <p className="text-sm text-muted-foreground">{descriptions[status.outcome]}{status.latestVersion ? ` Latest: ${status.latestVersion}.` : ""}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void perform("check")}>{busy === "check" ? "Checking…" : "Check for updates"}</Button>
      {status?.outcome === "update-available" && <Button size="sm" disabled={!!busy || disabled} onClick={() => void perform("update")}>{busy === "update" ? "Updating…" : "Update now"}</Button>}
      <a className="self-center text-xs text-muted-foreground underline underline-offset-4" href="https://github.com/notpritam/bb-plugin-guided-review/releases" target="_blank" rel="noreferrer">Release notes</a>
    </div>
    {disabled && <p className="text-xs text-muted-foreground">Save or discard your settings edits before updating.</p>}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 accent-current" checked={status?.automatic ?? false} disabled={!status || !!busy || (status.outcome === "pinned" && !status.automatic)} onChange={() => void perform("toggle")} /><span><span className="font-medium">Update automatically when idle</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Off by default. Checks hourly after five idle minutes, once all review and Settings pages are closed. Installs the latest compatible release through BB; saved reviews, drafts, notes, and preferences stay in place.</span></span></label>
    {(error || status?.error) && <p role="alert" className="text-sm text-destructive">{error || status?.error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}

export function SetupReadiness() {
  const rpc = useRpc<typeof rpcContract>();
  const [setup, setSetup] = useState<{ account: string | null; githubCli: boolean; agentAvailable: boolean | null; projectAvailable: boolean | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function check() {
    setBusy(true); setError("");
    try { setSetup(await rpc.call("getSetupStatus", null)); } catch { setError("Couldn’t check setup. Try again."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void check(); }, [rpc]);
  return <section aria-label="Setup" className="space-y-3 border-t border-border pt-5">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Ready to review</h2><Button variant="ghost" size="sm" disabled={busy} onClick={() => void check()}>{busy ? "Checking…" : "Check setup"}</Button></div>
    <p className="text-sm text-muted-foreground">Connect GitHub on the machine running BB, then paste a PR link. Guides use your BB agent and its normal usage allowance.</p>
    {setup && <ul className="space-y-2 text-sm">
      <li>{setup.githubCli ? "GitHub CLI installed" : "Install GitHub CLI on the BB server."}</li>
      <li>{setup.account ? <>GitHub account: <strong>@{setup.account}</strong></> : <>Sign in on the BB server: <code className="break-all text-xs">gh auth login --hostname github.com</code></>}</li>
      <li>{setup.agentAvailable === true ? "BB agent available" : setup.agentAvailable === false ? "Connect an agent provider in BB Settings before generating a guide." : "Couldn’t verify the agent provider. Check BB Settings."}</li>
      {setup.projectAvailable !== true && <li>{setup.projectAvailable === false ? "Add a BB project before starting a review." : "Couldn’t verify the BB project. Check your project list."}</li>}
    </ul>}
    <p className="text-xs leading-relaxed text-muted-foreground">Use your own BB installation for your own GitHub identity. On a shared installation, account selection and saved reviews are shared. The selected account must have access to the PR repository.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
