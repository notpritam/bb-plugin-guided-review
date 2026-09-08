// @vitest-environment jsdom
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

afterEach(cleanup);
const account = () => ({ active: "reviewer", accounts: [{ login: "reviewer", active: true }] });

test("list load failure is distinct from an empty account and can recover", async () => {
  let offline = true;
  const app = await loadPluginApp(() => import("../app"));
  const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, { rpc: {
    getGhAccounts: account,
    listReviews: () => { if (offline) throw new Error("offline"); return { reviews: [{ targetKey: "repo-pr-7", title: "Preserved review", status: "ready" }] }; },
  } });
  await slot.findByText("Couldn’t load your reviews");
  expect(slot.queryByText("No reviews yet")).toBeNull();
  offline = false;
  fireEvent.click(slot.getByRole("button", { name: "Try again" }));
  await slot.findByText("Preserved review");
  slot.lifecycle.unmount();
});

test("workspace load failure has retry instead of an endless generation skeleton", async () => {
  const app = await loadPluginApp(() => import("../app"));
  const slot = renderSlot(app.navPanels[0]!, { subPath: "missing" }, { rpc: {
    getReview: () => { throw new Error("Connection lost"); },
    getGuide: () => ({ guide: null, status: "generating" }),
    getPatch: () => ({ patch: "" }), getChecks: () => ({ bucket: "none", checks: [] }),
  } });
  await slot.findByText("Couldn’t load this review");
  expect(slot.getByRole("button", { name: "Try again" })).toBeTruthy();
  expect(slot.getByRole("button", { name: "All reviews" })).toBeTruthy();
  slot.lifecycle.unmount();
});

test("draft summary persists on leaving the field; submit is explicit and locked", async () => {
  await loadPluginApp(() => import("../app"));
  const { DraftTray } = await import("./DraftTray");
  let stored = { targetKey: "pr-7", verdict: "COMMENT", body: "", comments: [] };
  const setVerdict = vi.fn(async (input: any) => { stored = { ...stored, ...input }; return { draft: stored }; });
  let release: (result: { ok: boolean }) => void = () => {};
  const submitReview = vi.fn(() => new Promise<{ ok: boolean }>((resolve) => { release = resolve; }));
  const slot = renderSlot({ component: (props: any) => <DraftTray {...props} /> }, { targetKey: "pr-7", activeChapterId: "core", activeFiles: ["file.ts"] }, { rpc: {
    getDraft: () => ({ draft: stored }), setVerdict, submitReview,
  } });
  await slot.findByText("Draft saved");
  expect(submitReview).not.toHaveBeenCalled();
  fireEvent.click(slot.getByRole("button", { name: "Review notes" }));
  const notes = slot.getByRole("textbox", { name: "Review summary" });
  fireEvent.change(notes, { target: { value: "A considered review" } });
  fireEvent.blur(notes);
  await waitFor(() => expect(stored.body).toBe("A considered review"));
  const submit = slot.getByRole("button", { name: "Submit to GitHub" });
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(submitReview).toHaveBeenCalledTimes(1));
  release({ ok: false });
  await slot.findByRole("button", { name: "Submit to GitHub" });
  expect(stored.body).toBe("A considered review");
  slot.lifecycle.unmount();
});

test("local review keeps draft notes but never offers GitHub submission", async () => {
  await loadPluginApp(() => import("../app"));
  const { DraftTray } = await import("./DraftTray");
  const slot = renderSlot({ component: (props: any) => <DraftTray {...props} /> }, { targetKey: "ref-local", activeChapterId: "core", activeFiles: ["file.ts"], isLocal: true }, { rpc: {
    getDraft: () => ({ draft: { targetKey: "ref-local", verdict: "COMMENT", body: "", comments: [] } }),
  } });
  await slot.findByText("Local review. Comments and notes stay in this BB installation.");
  expect(slot.queryByRole("button", { name: "Submit to GitHub" })).toBeNull();
  slot.lifecycle.unmount();
});

test("failed draft loading blocks edits and preserves the stored draft", async () => {
  await loadPluginApp(() => import("../app"));
  const { DraftTray } = await import("./DraftTray");
  const setVerdict = vi.fn();
  const slot = renderSlot({ component: (props: any) => <DraftTray {...props} /> }, { targetKey: "pr-7", activeChapterId: "core", activeFiles: [] }, { rpc: {
    getDraft: () => { throw new Error("offline"); }, setVerdict,
  } });
  await slot.findByRole("button", { name: "Retry draft" });
  expect(slot.queryByRole("button", { name: "Submit to GitHub" })).toBeNull();
  expect(setVerdict).not.toHaveBeenCalled();
  slot.lifecycle.unmount();
});
