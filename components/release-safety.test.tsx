import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { defaultPreferences } from "../src/preferences";
import { readDraftRecovery } from "../lib/draft-recovery";
afterEach(() => { cleanup(); sessionStorage.clear(); });

test("closing a document releases its lease, while a cached page keeps its editors protected", async () => {
  await loadPluginApp(() => import("../app"));
  const { useReviewSession } = await import("../lib/review-session");
  const presence = vi.fn(() => ({ ok: true }));
  const beacon = vi.fn(() => true);
  const original = navigator.sendBeacon;
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
  try {
    const slot = renderSlot({ component: () => { const session = useReviewSession(); return <p>{session.ready ? "Ready" : "Opening"}</p>; } }, {}, { rpc: { setReviewPresence: presence } });
    await slot.findByText("Ready");
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })); expect(beacon).not.toHaveBeenCalled();
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    expect(beacon).toHaveBeenCalledWith("/api/v1/plugins/guided-review/rpc/setReviewPresence", expect.any(Blob));
    slot.lifecycle.unmount();
  } finally { Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: original }); }
});

test("an unmounted editor's delayed save cannot remove a newer recovery edit", async () => {
  await loadPluginApp(() => import("../app"));
  const { DraftTray } = await import("./DraftTray");
  let finish!: (result: any) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockRejectedValue(new Error("Offline"));
  const component = () => <DraftTray targetKey="delayed-recovery" activeChapterId="chapter" activeFiles={[]} reviewRevision="revision" />;
  const rpc = { getDraft: () => ({ draft: { targetKey: "delayed-recovery", verdict: "COMMENT", body: "", comments: [] } }), setVerdict: save };
  const first = renderSlot({ component }, {}, { rpc }); await first.findByText("Draft saved");
  fireEvent.click(first.getByRole("button", { name: "Review summary" }));
  fireEvent.change(first.getByRole("textbox", { name: "Review summary" }), { target: { value: "First version" } });
  first.lifecycle.unmount(); await waitFor(() => expect(finish).toBeTypeOf("function"));
  const second = renderSlot({ component }, {}, { rpc });
  const summary = await second.findByRole("textbox", { name: "Review summary" });
  fireEvent.change(summary, { target: { value: "Newer recovered edits" } }); fireEvent.blur(summary);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  finish({ draft: {} });
  await Promise.resolve(); await Promise.resolve();
  expect(readDraftRecovery("delayed-recovery").summary?.body).toBe("Newer recovered edits");
});

test("a rejected unmount save recovers text with its original revision after reopening", async () => {
  await loadPluginApp(() => import("../app"));
  const { DraftTray } = await import("./DraftTray");
  const draft = { targetKey: "recovery", verdict: "COMMENT", body: "", comments: [] };
  const save = vi.fn(async (_input: any) => { throw new Error("Review changed"); });
  const rpc = { getDraft: () => ({ draft }), setVerdict: save };
  const component = (props: any) => <DraftTray targetKey="recovery" activeChapterId="chapter" activeFiles={["a.ts"]} {...props} />;
  const first = renderSlot({ component }, { reviewRevision: "old" }, { rpc });
  await first.findByText("Draft saved");
  fireEvent.click(first.getByRole("button", { name: "Review summary" }));
  fireEvent.change(first.getByRole("textbox", { name: "Review summary" }), { target: { value: "Unsaved reasoning" } });
  first.lifecycle.unmount();
  await waitFor(() => expect(save).toHaveBeenCalled());
  const second = renderSlot({ component }, { reviewRevision: "new" }, { rpc });
  const summary = await second.findByRole("textbox", { name: "Review summary" });
  expect((summary as HTMLTextAreaElement).value).toBe("Unsaved reasoning");
  fireEvent.click(second.getByRole("button", { name: "Save again" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.at(-1)?.[0]).toMatchObject({ revision: "old", body: "Unsaved reasoning" });
});

test("manual update locks settings editors until replacement completes", async () => {
  await loadPluginApp(() => import("../app"));
  const { ReviewSettings } = await import("./ReviewSettings");
  const status = { installedVersion: "0.2.0", automatic: false, updating: false, outcome: "update-available", latestVersion: "0.2.1", candidateVersion: "new", checkedAt: 1, error: null };
  let finish!: (result: any) => void;
  const slot = renderSlot({ component: ReviewSettings }, {}, { rpc: {
    setReviewPresence: () => ({ ok: true }), getPreferences: () => ({ preferences: defaultPreferences, revision: 0 }),
    getReleaseStatus: () => status, applyPluginUpdate: () => new Promise(resolve => { finish = resolve; }),
    getSetupStatus: () => ({ account: "casey", githubCli: true, agentAvailable: true, projectAvailable: true }),
  } });
  fireEvent.click(await slot.findByRole("button", { name: "Update now" }));
  await waitFor(() => expect(finish).toBeTypeOf("function"));
  expect((slot.getByRole("textbox", { name: "Guide instructions" }) as HTMLTextAreaElement).closest("fieldset")?.disabled).toBe(true);
  finish({ outcome: "updated", version: "0.2.1" });
  await slot.findByText(/Updated to 0.2.1/);
});
