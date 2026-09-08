import { test, expect, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";
import { createStore } from "./store";
import { generateGuide, stopGuideGenerations } from "./generate";

const guide = { title: "T", intent: "I", sections: [], unplacedFiles: [] };

test("failed regeneration does not mark an old guide ready", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: { spawn: async () => { throw new Error("offline"); } } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "ready", createdAt: 1 });
  store.saveGuide("target", guide);
  await generateGuide(bb, store, "target", "p1");
  expect(store.getGuide("target")).toBeNull();
  expect(store.getReview("target")?.status).toBe("error");
});

test("a superseded generation cannot replace a newer guide", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(bb);
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "generating", createdAt: 1 });
  const old = store.beginGeneration("target");
  const current = store.beginGeneration("target");
  expect((await harness.behavior.callAgentTool("generate_review_guide", { targetKey: "target", generationId: current, guide })).isError).toBeFalsy();
  expect((await harness.behavior.callAgentTool("generate_review_guide", { targetKey: "target", generationId: old, guide: { ...guide, title: "Old result" } })).isError).toBe(true);
  expect(store.getGuide("target")?.title).toBe("T");
});

test("hidden workers are archived and stopped when waiting fails", async () => {
  const archive = vi.fn(async () => {});
  const stop = vi.fn(async () => {});
  const { bb } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "worker" }), wait: async () => { throw new Error("timeout"); }, archive, stop,
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "generating", createdAt: 1 });
  await generateGuide(bb, store, "target", "p1");
  expect(archive).toHaveBeenCalledWith({ threadId: "worker" });
  expect(stop).toHaveBeenCalledWith({ threadId: "worker" });
  expect(store.getReview("target")?.status).toBe("error");
});

test("restart marks persisted in-progress reviews as interrupted without discarding drafts", async () => {
  const { bb } = createFakePluginHost({ pluginId: "guided-review" });
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "generating", createdAt: 1 });
  const old = store.beginGeneration("target");
  store.setVerdict("target", "COMMENT", "Keep this draft");
  await plugin(bb);
  expect(store.getReview("target")?.status).toBe("error");
  expect(store.isCurrentGeneration("target", old)).toBe(false);
  expect(store.getDraft("target").body).toBe("Keep this draft");
});

test("disposal aborts a pending worker wait and releases the worker", async () => {
  const stop = vi.fn(async () => {});
  let waiting = false;
  const { bb } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "worker" }),
    wait: ({ signal }: { signal: AbortSignal }) => new Promise((resolve) => {
      waiting = true;
      signal.addEventListener("abort", () => resolve({ matched: false }), { once: true });
    }),
    archive: async () => {}, stop,
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "generating", createdAt: 1 });
  const run = generateGuide(bb, store, "target", "p1");
  await vi.waitFor(() => expect(waiting).toBe(true));
  stopGuideGenerations(bb);
  await run;
  expect(stop).toHaveBeenCalledWith({ threadId: "worker" });
  expect(store.getReview("target")?.status).toBe("error");
});
