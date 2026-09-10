import { expect, test, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createStore } from "./store";
import { runAgentTurn, stopReviewAgents } from "./agent";
import { bindGhAccount } from "./gh-identity";

test("reused assistant receives the current guide after re-review", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "agent" }), get: async () => ({}), send: async () => {},
    wait: async () => {}, output: async () => "Answer", stop: async () => {},
  } } });
  const store = createStore(bb);
  const guide = (intent: string) => ({ title: "Change", intent, sections: [], unplacedFiles: [] });
  store.saveGuide("pr-1", guide("Old behavior") as any);
  await runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "project", message: "Explain" });
  store.saveGuide("pr-1", guide("New retry behavior") as any); store.savePatch("pr-1", "new patch");
  await runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "project", message: "What changed?" });
  const sent = JSON.stringify(harness.inspection.sdk.callsTo("threads.send"));
  expect(sent).toContain("New retry behavior"); expect(sent).toContain("supersedes earlier review context");
});

test("a revision change during output retrieval rejects the stale assistant answer", async () => {
  let finish!: (answer: string) => void;
  const { bb } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "agent" }), wait: async () => {}, stop: async () => {},
    output: () => new Promise<string>(resolve => { finish = resolve; }),
  } } });
  const store = createStore(bb); store.savePatch("pr-1", "original patch");
  const answer = runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "project", message: "Explain" });
  const outcome = answer.catch(error => error);
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  store.savePatch("pr-1", "updated patch"); finish("Old answer");
  expect((await outcome).message).toMatch(/review changed/i);
  expect(store.listAgentMessages("pr-1").some(message => message.role === "assistant")).toBe(false);
});

test("disposing a plugin aborts its assistant wait and stops the worker using the captured SDK", async () => {
  let waiting = false;
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "agent" }), stop: async () => {},
    wait: ({ signal }: { signal?: AbortSignal }) => new Promise<void>((_resolve, reject) => {
      waiting = true; signal?.addEventListener("abort", () => reject(new Error("Interrupted")), { once: true });
    }),
  } } });
  bb.onDispose(() => stopReviewAgents(bb));
  const turn = runAgentTurn(bb, createStore(bb), { targetKey: "pr-1", projectId: "project", message: "Explain" });
  const outcome = turn.catch(error => error);
  await vi.waitFor(() => expect(waiting).toBe(true));
  await harness.lifecycle.dispose();
  expect(await outcome).toBeInstanceOf(Error);
  expect(harness.inspection.sdk.callsTo("threads.stop")).toEqual([[{ threadId: "agent" }]]);
});

test("one submission uses the verified identity even if the global account changes", async () => {
  const run = vi.fn(async (args: string[], opts?: { authToken?: string }) => {
    if (args[0] === "auth") return { code: 0, stdout: "test-only-credential", stderr: "" };
    if (args[1] === "user") return { code: 0, stdout: opts?.authToken === "test-only-credential" ? "casey" : "different-user", stderr: "" };
    return { code: 0, stdout: "{}", stderr: "" };
  });
  const bound = await bindGhAccount(run, "casey");
  await bound(["api", "-X", "POST", "repos/example/project/pulls/1/reviews"]);
  expect(run.mock.calls.at(-1)?.[1]).toMatchObject({ authToken: "test-only-credential" });
  await expect(bindGhAccount(run, "someone-else")).rejects.toThrow(/account changed/i);
});
