import { expect, test } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";
import { createStore } from "./store";
import { defaultPreferences } from "./preferences";
import { buildGenerationPrompt } from "./generate";
import { generateGuide } from "./generate";
import { runAgentTurn } from "./agent";

test("settings persist across stores, reject stale edits, and validate input", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(bb);
  const initial = await harness.behavior.callRpc("getPreferences", null) as any;
  expect(initial.preferences).toEqual(defaultPreferences);
  const preferences = { ...initial.preferences, guideDetail: "detailed", guideInstructions: "Explain migration risks", assistantInstructions: "Focus on security" };
  const saved = await harness.behavior.callRpc("savePreferences", { preferences, revision: initial.revision }) as any;
  expect(saved.revision).toBe(1);
  expect(createStore(bb).getPreferences().preferences).toEqual(preferences);
  await expect(harness.behavior.callRpc("savePreferences", { preferences, revision: 0 })).rejects.toThrow(/changed/);
  await expect(harness.behavior.callRpc("savePreferences", { preferences: { ...preferences, guideDetail: "invalid" }, revision: 1 })).rejects.toThrow();
  expect(buildGenerationPrompt("pr-1", "run-1", preferences)).toContain("Explain migration risks");
  expect(buildGenerationPrompt("pr-1", "run-1", preferences)).toContain("Detailed");
  expect(buildGenerationPrompt("pr-1", "run-1", preferences)).not.toContain("Focus on security");
});

test("private notes persist independently of drafts, with conflict protection", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(bb);
  const store = createStore(bb);
  store.saveReview({ targetKey: "pr-1", kind: "pr", status: "ready", createdAt: 1 });
  store.setVerdict("pr-1", "COMMENT", "Existing public summary");
  expect(await harness.behavior.callRpc("getReviewerNotes", { targetKey: "pr-1" })).toEqual({ body: "", revision: 0 });
  await harness.behavior.callRpc("saveReviewerNotes", { targetKey: "pr-1", body: "Private thought", revision: 0 });
  await expect(harness.behavior.callRpc("saveReviewerNotes", { targetKey: "pr-1", body: "Stale edit", revision: 0 })).rejects.toThrow(/changed/);
  store.clearSubmittedDraft(store.getDraft("pr-1"));
  store.setLifecycle("pr-1", { prState: "MERGED", archivedAt: Date.now() });
  expect(createStore(bb).getReviewerNotes("pr-1")).toEqual({ body: "Private thought", revision: 1 });
  expect(store.getDraft("pr-1").body).toBe("");
});

test("workers receive current customization without private notes, including an existing conversation", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    get: async () => ({ archivedAt: null, deletedAt: null }),
    spawn: async () => ({ id: "worker" }), send: async () => ({}), wait: async () => {}, output: async () => "Answer", stop: async () => {}, archive: async () => {},
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "target", kind: "ref", status: "ready", createdAt: 1 });
  store.saveReviewerNotes("target", "PRIVATE-SCRATCHPAD", 0);
  store.savePreferences({ ...defaultPreferences, guideInstructions: "Explain public contracts", assistantInstructions: "First preference" }, 0);
  await generateGuide(bb, store, "target", "project");
  expect(harness.inspection.sdk.callsTo("threads.spawn")[0][0]).toMatchObject({ prompt: expect.stringContaining("Explain public contracts") });
  await runAgentTurn(bb, store, { targetKey: "target", projectId: "project", message: "Explain this" });
  store.savePreferences({ ...defaultPreferences, assistantInstructions: "Updated preference" }, 1);
  await runAgentTurn(bb, store, { targetKey: "target", projectId: "project", message: "And this?" });
  const sent = JSON.stringify(harness.inspection.sdk.callsTo("threads.send"));
  expect(sent).toContain("Updated preference");
  expect(sent).not.toContain("First preference");
  expect(JSON.stringify(harness.inspection.sdk.callsTo("threads.spawn")) + sent).not.toContain("PRIVATE-SCRATCHPAD");
});
