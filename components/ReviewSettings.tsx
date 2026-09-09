import { useCallback, useEffect, useState } from "react";
import { useRpc, useBbNavigate } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";
import type { PreferencesRecord } from "../src/preferences";
import { defaultPreferences } from "../lib/review-preferences";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useReviewSession } from "../lib/review-session";
import { ReleaseSettings, SetupReadiness } from "./ReleaseSettings";
import { Icon } from "./ui/icon";

// Plain function: the host slot collector requires a component function.
export function ReviewSettings({ onBack }: { onBack?: () => void }) {
  const rpc = useRpc<typeof rpcContract>();
  const session = useReviewSession();
  const [record, setRecord] = useState<PreferencesRecord | null>(null);
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try { const result = await rpc.call("getPreferences", null); setRecord(result); setBaseline(JSON.stringify(result.preferences)); }
    catch { setError("Couldn’t load settings. Try again."); }
  }, [rpc]);
  useEffect(() => { void load(); }, [load]);
  const dirty = record !== null && baseline !== JSON.stringify(record.preferences);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  async function save() {
    if (!record || busy || updating) return;
    setBusy(true); setError(""); setSaved(false);
    try { const result = await rpc.call("savePreferences", record); setRecord(result); setBaseline(JSON.stringify(result.preferences)); setSaved(true); }
    catch (error) { setError(error instanceof Error ? error.message : "Couldn’t save settings. Your edits are still here."); }
    finally { setBusy(false); }
  }
  if (!session.ready) return <div className="space-y-3 p-6"><p role={session.error ? "alert" : "status"}>{session.error || "Opening settings…"}</p>{session.error && <Button onClick={session.retry}>Try again</Button>}</div>;
  return <div className="h-full min-w-0 overflow-y-auto" style={{ backgroundColor: "rgb(from var(--background) r g b / 1)" }}>
    <div className="mx-auto w-full max-w-6xl space-y-7 px-4 py-5 sm:px-8">
      <div className="space-y-3">
        {onBack && <Button variant="ghost" size="sm" onClick={onBack} disabled={dirty || busy || updating}><Icon name="ArrowRight" className="size-4 rotate-180" aria-hidden /> Back to review</Button>}
        <div><h1 className="text-xl font-semibold">Review settings</h1><p className="mt-1 text-sm text-muted-foreground">Shape your guides and how the assistant helps you review. Applies across this BB installation.</p></div>
      </div>
      <SetupReadiness />
      <ReleaseSettings clientId={session.clientId} disabled={dirty || busy} onUpdatingChange={setUpdating} />
      <section className="space-y-2 border-t border-border pt-5">
        <h2 className="text-sm font-semibold">Guide notifications</h2>
        <p className="text-sm text-muted-foreground">Needs You can alert you when a guide is ready or generation fails, with a link back to the review. Install or update Needs You to 0.2.0-beta.3 or later, then enable Extension activity in its Settings. Telegram is optional.</p>
        <a className="text-sm underline underline-offset-4" href="/plugins/inbox/inbox/settings" target="_blank" rel="noreferrer">Open Needs You settings</a>
      </section>
      {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" size="sm" disabled={busy || updating} onClick={() => void load()}>Reload saved settings</Button></div>}
      {!record ? !error && <p role="status">Loading settings…</p> : <>
        <fieldset disabled={busy || updating} className="space-y-6">
          <section className="space-y-4 border-t border-border pt-5">
            <div><h2 className="text-sm font-semibold">Guide generation</h2><p className="mt-1 text-sm text-muted-foreground">Used when starting a guide or running Re-review. Existing guides stay as written.</p></div>
            <div className="space-y-2"><p id="guide-detail-label" className="text-sm font-medium">Detail level</p><div role="group" aria-labelledby="guide-detail-label" className="flex flex-wrap gap-2">
              {(["concise", "standard", "detailed"] as const).map((value) => <Button key={value} variant="outline" size="sm" className="aria-pressed:border-foreground aria-pressed:bg-state-active" aria-pressed={record.preferences.guideDetail === value} onClick={() => { setSaved(false); setRecord({ ...record, preferences: { ...record.preferences, guideDetail: value } }); }}>{value[0].toUpperCase() + value.slice(1)}</Button>)}
            </div></div>
            <label className="block space-y-2"><span className="text-sm font-medium">Guide instructions</span><Textarea aria-label="Guide instructions" maxLength={12000} rows={6} value={record.preferences.guideInstructions} onChange={(event) => { setSaved(false); setRecord({ ...record, preferences: { ...record.preferences, guideInstructions: event.target.value } }); }} placeholder="Explain data migrations and compatibility. Keep tests with the behavior they cover. Write for engineers new to this repository." /><span className="block text-xs text-muted-foreground">Add review priorities, language, and team conventions. These extend the built-in guide skill.</span></label>
            <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">About the guide skill</summary><div className="mt-3 space-y-2 text-muted-foreground"><p>The bundled skill reads the complete diff, organizes chapters by meaning, and covers every changed file exactly once. Custom instructions shape its explanations while the required output format stays validated.</p><p>Based on the chaptered walkthrough approach from <a className="underline underline-offset-4" href="https://github.com/plannotator/guides/blob/main/skills/plannotator-guide/SKILL.md" target="_blank" rel="noreferrer">Plannotator’s guide skill</a>, adapted for BB. Guides run through your BB project’s agent.</p></div></details>
          </section>
          <section className="space-y-4 border-t border-border pt-5">
            <div><h2 className="text-sm font-semibold">Review assistant</h2><p className="mt-1 text-sm text-muted-foreground">Applies to your next message, including conversations already in progress.</p></div>
            <label className="block space-y-2"><span className="text-sm font-medium">Assistant instructions</span><Textarea aria-label="Assistant instructions" maxLength={12000} rows={5} value={record.preferences.assistantInstructions} onChange={(event) => { setSaved(false); setRecord({ ...record, preferences: { ...record.preferences, assistantInstructions: event.target.value } }); }} placeholder="Prioritize correctness and security. Show a concrete failure case for suspected bugs. Keep suggestions actionable." /></label>
          </section>
          <section className="space-y-3 border-t border-border pt-5">
            <div><h2 className="text-sm font-semibold">Reading layout</h2><p className="mt-1 text-sm text-muted-foreground">Choose the default diff layout. Narrow screens use a single column.</p></div>
            <div role="group" aria-label="Default diff layout" className="flex flex-wrap gap-2">{([ ["split", "Side by side"], ["unified", "Unified"] ] as const).map(([value, label]) => <Button key={value} variant="outline" size="sm" className="aria-pressed:border-foreground aria-pressed:bg-state-active" aria-pressed={record.preferences.diffLayout === value} onClick={() => { setSaved(false); setRecord({ ...record, preferences: { ...record.preferences, diffLayout: value } }); }}>{label}</Button>)}</div>
          </section>
        </fieldset>
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background py-4">
          <Button disabled={!dirty || busy || updating} onClick={() => void save()}>{busy ? "Saving…" : "Save settings"}</Button>
          {dirty && <Button variant="ghost" disabled={busy || updating} onClick={() => { setRecord({ ...record, preferences: JSON.parse(baseline) }); setError(""); }}>Discard edits</Button>}
          <span role="status" className="text-xs text-muted-foreground">{saved ? "Settings saved" : dirty ? "Unsaved changes" : ""}</span>
          <Button variant="ghost" size="sm" className="ml-auto" disabled={busy || updating} onClick={() => { setSaved(false); setRecord({ ...record, preferences: { ...defaultPreferences } }); }}>Restore defaults</Button>
        </div>
      </>}
    </div>
  </div>;
}

export function ReviewSettingsPage({ returnTo = "" }: { returnTo?: string }) {
  const navigate = useBbNavigate();
  return <ReviewSettings onBack={() => navigate.toPluginPanel("review", { subPath: returnTo })} />;
}
