import { test, expect, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createStore } from "./store";
import { runAgentTurn, buildSeedPrompt, buildTurnText, extractSelectedLines } from "./agent";
import { createReviewSync } from "./review-lifecycle";

const linePatch = [
  "diff --git a/x.ts b/x.ts",
  "--- a/x.ts",
  "+++ b/x.ts",
  "@@ -1,3 +1,4 @@",
  " a",
  "-b",
  "+b2",
  "+c",
  " d",
  "",
].join("\n");

function host() {
  let spawns = 0;
  let sends = 0;
  const { bb } = createFakePluginHost({
    pluginId: "guided-review",
    sdk: {
      threads: {
        get: async () => ({ archivedAt: null, deletedAt: null }),
        spawn: async () => {
          spawns++;
          return { id: "th_agent" };
        },
        send: async () => {
          sends++;
          return { ok: true };
        },
        wait: async () => {},
        output: async () => "It's a test file — safe to skim.",
        open: async () => ({ delivered: 1 }),
        archive: async () => {},
        stop: async () => {},
      },
    },
  });
  return { bb, counts: () => ({ spawns, sends }) };
}

test("first turn spawns one persistent thread, logs both messages, returns answer", async () => {
  const { bb, counts } = host();
  const store = createStore(bb);
  store.savePatch("pr-1", "diff --git a/a.ts b/a.ts\n+x\n");
  const res = await runAgentTurn(bb, store, { targetKey: "pr-1", message: "why flagged?", projectId: "p1" });
  expect(res.answer).toContain("skim");
  expect(counts().spawns).toBe(1);
  expect(store.getAgentThread("pr-1")).toBe("th_agent");
  const msgs = store.listAgentMessages("pr-1");
  expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
});

test("a later turn reuses the thread via send, does not spawn again", async () => {
  const { bb, counts } = host();
  const store = createStore(bb);
  store.savePatch("pr-1", "diff --git a/a.ts b/a.ts\n+x\n");
  await runAgentTurn(bb, store, { targetKey: "pr-1", message: "first", projectId: "p1" });
  await runAgentTurn(bb, store, { targetKey: "pr-1", message: "second", projectId: "p1" });
  expect(counts().spawns).toBe(1);
  expect(counts().sends).toBe(1);
  expect(store.listAgentMessages("pr-1")).toHaveLength(4);
});

test("seed prompt carries intent, chapter outline, and the read tool + targetKey", () => {
  const seed = buildSeedPrompt(
    {
      title: "T",
      intent: "Add token refresh",
      sections: [{ id: "s1", title: "Auth", overview: "refresh before expiry", diffs: [] }],
      unplacedFiles: [],
    } as any,
    "pr-42",
  );
  expect(seed).toContain("Add token refresh");
  expect(seed).toContain("Auth");
  expect(seed).toContain("read_review_patch");
  expect(seed).toContain("pr-42");
});

test("review conversations stay hidden and release the runtime after each turn", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    spawn: async () => ({ id: "hidden-agent" }), wait: async () => {},
    output: async () => "Answer", stop: async () => {},
  } } });
  await runAgentTurn(bb, createStore(bb), { targetKey: "pr-1", message: "Explain", projectId: "p1" });
  expect(harness.inspection.sdk.callsTo("threads.spawn")[0][0]).toMatchObject({ visibility: "hidden" });
  expect(harness.inspection.sdk.callsTo("threads.stop")).toHaveLength(1);
});

test("turn text inlines a highlighted code selection when provided", () => {
  const text = buildTurnText({
    message: "is this safe?",
    context: { file: "a.ts", startLine: 3, endLine: 4, code: "const x = 1" },
    patch: "",
  });
  expect(text).toContain("is this safe?");
  expect(text).toContain("a.ts");
  expect(text).toContain("const x = 1");
});

test("extractSelectedLines pulls the exact new-side lines of a range", () => {
  expect(extractSelectedLines(linePatch, "x.ts", 2, 3, "additions")).toBe("+b2\n+c");
});

test("extractSelectedLines pulls old-side (deletions) lines", () => {
  expect(extractSelectedLines(linePatch, "x.ts", 2, 2, "deletions")).toBe("-b");
});

test("a line-range selection inlines exactly those lines and focuses the agent", () => {
  const text = buildTurnText({
    message: "why this loop?",
    context: { file: "x.ts", startLine: 2, endLine: 3, side: "additions" },
    patch: linePatch,
  });
  expect(text).toContain("x.ts lines 2-3");
  expect(text).toContain("+b2");
  expect(text).toContain("+c");
  expect(text).toContain("Focus on exactly these lines");
});

test("a deleted worker is replaced with hidden compute while retaining conversation context", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    get: async () => ({ archivedAt: null, deletedAt: null }),
    send: async () => { throw new Error("HTTP 404: Thread not found"); },
    spawn: async () => ({ id: "replacement" }), wait: async () => {}, output: async () => "Continued answer", stop: async () => {},
  } } });
  const store = createStore(bb);
  store.setAgentThread("pr-1", "deleted");
  store.appendAgentMessage("pr-1", "assistant", "Earlier explanation");
  expect(await runAgentTurn(bb, store, { targetKey: "pr-1", message: "Go on", projectId: "p1" })).toEqual({ answer: "Continued answer" });
  expect(store.getAgentThread("pr-1")).toBe("replacement");
  expect(harness.inspection.sdk.callsTo("threads.spawn")[0][0]).toMatchObject({ visibility: "hidden", prompt: expect.stringContaining("Earlier explanation") });
});

test("an archived worker is replaced without reopening it, preserving the conversation", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    get: async () => ({ archivedAt: 123, deletedAt: null }),
    spawn: async () => ({ id: "fresh-hidden-worker" }), wait: async () => {}, output: async () => "New answer", stop: async () => {},
  } } });
  const store = createStore(bb);
  store.setAgentThread("pr-1", "archived-worker");
  store.appendAgentMessage("pr-1", "assistant", "Earlier explanation");
  await runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "p1", message: "Continue the review" });
  expect(harness.inspection.sdk.callsTo("threads.send")).toHaveLength(0);
  expect(harness.inspection.sdk.callsTo("threads.spawn")[0][0]).toMatchObject({ visibility: "hidden", prompt: expect.stringContaining("Earlier explanation") });
  expect(store.getAgentThread("pr-1")).toBe("fresh-hidden-worker");
  expect(store.listAgentMessages("pr-1").map((message) => message.text)).toEqual(["Earlier explanation", "Continue the review", "New answer"]);
});

test("a thread lookup failure keeps its mapping and does not create another worker", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    get: async () => { throw new Error("Connection unavailable"); }, stop: async () => {},
  } } });
  const store = createStore(bb);
  store.setAgentThread("pr-1", "existing");
  await expect(runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "p1", message: "Continue" })).rejects.toThrow("Connection unavailable");
  expect(store.getAgentThread("pr-1")).toBe("existing");
  expect(harness.inspection.sdk.callsTo("threads.spawn")).toHaveLength(0);
});

test("a new answer on an archived review finishes before its fresh worker is archived", async () => {
  let finish!: () => void;
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    get: async () => ({ archivedAt: 123, deletedAt: null }),
    spawn: async () => ({ id: "fresh" }), wait: () => new Promise<void>((resolve) => { finish = resolve; }),
    output: async () => "Finished answer", stop: async () => {}, archive: async () => {}, update: async () => {},
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "pr-1", kind: "pr", repo: "a/b", number: 1, status: "ready", createdAt: 1 });
  store.setLifecycle("pr-1", { prState: "MERGED", archivedAt: 123 });
  store.setAgentThread("pr-1", "archived-worker");
  const args = { targetKey: "pr-1", projectId: "p1", message: "One more question" };
  const answer = runAgentTurn(bb, store, args);
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await expect(runAgentTurn(bb, store, args)).rejects.toThrow("already in progress");
  const sync = createReviewSync(bb, store, vi.fn());
  await sync.one("pr-1", true);
  expect(harness.inspection.sdk.callsTo("threads.archive")).toHaveLength(0);
  expect(harness.inspection.sdk.callsTo("threads.stop")).toHaveLength(0);
  finish();
  await expect(answer).resolves.toEqual({ answer: "Finished answer" });
  expect(harness.inspection.sdk.callsTo("threads.archive")).toEqual([[{ threadId: "fresh" }]]);
  expect(store.listAgentMessages("pr-1")).toHaveLength(2);
  expect(store.getReview("pr-1")?.prState).toBe("MERGED");
});

test("a question arriving during archival waits for cleanup, then starts a fresh hidden worker", async () => {
  let releaseStop!: () => void;
  let finishAnswer!: () => void;
  const archived = new Set<string>();
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    update: async () => {},
    stop: ({ threadId }: { threadId: string }) => threadId === "old-worker"
      ? new Promise<void>((resolve) => { releaseStop = resolve; }) : Promise.resolve(),
    archive: async ({ threadId }: { threadId: string }) => { archived.add(threadId); },
    get: async ({ threadId }: { threadId: string }) => ({ archivedAt: archived.has(threadId) ? 123 : null, deletedAt: null }),
    spawn: async () => ({ id: "fresh-worker" }),
    wait: () => new Promise<void>((resolve) => { finishAnswer = resolve; }),
    output: async () => "Continued answer",
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "pr-1", kind: "pr", repo: "a/b", number: 1, status: "ready", createdAt: 1 });
  store.setLifecycle("pr-1", { prState: "MERGED", archivedAt: 123 });
  store.setAgentThread("pr-1", "old-worker");
  store.appendAgentMessage("pr-1", "assistant", "Earlier explanation");
  const cleanup = createReviewSync(bb, store, vi.fn()).one("pr-1");
  await vi.waitFor(() => expect(releaseStop).toBeTypeOf("function"));

  const args = { targetKey: "pr-1", projectId: "p1", message: "Continue" };
  const answer = runAgentTurn(bb, store, args);
  expect(harness.inspection.sdk.callsTo("threads.get")).toHaveLength(0);
  await expect(runAgentTurn(bb, store, args)).rejects.toThrow("already in progress");
  releaseStop();
  await cleanup;
  await vi.waitFor(() => expect(finishAnswer).toBeTypeOf("function"));
  expect(harness.inspection.sdk.callsTo("threads.send")).toHaveLength(0);
  expect(harness.inspection.sdk.callsTo("threads.spawn")[0][0]).toMatchObject({ visibility: "hidden", prompt: expect.stringContaining("Earlier explanation") });
  expect([...archived]).toEqual(["old-worker"]);
  expect(store.getAgentThread("pr-1")).toBe("fresh-worker");
  finishAnswer();
  await expect(answer).resolves.toEqual({ answer: "Continued answer" });
  expect([...archived]).toEqual(["old-worker", "fresh-worker"]);
});

test("a delayed missing-worker cleanup cannot erase the next question's replacement mapping", async () => {
  let failUpdate!: (error: Error) => void;
  let finishAnswer!: () => void;
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review", sdk: { threads: {
    update: () => new Promise<void>((_resolve, reject) => { failUpdate = reject; }),
    get: async () => ({ archivedAt: null, deletedAt: 123 }),
    spawn: async () => ({ id: "fresh-worker" }),
    wait: () => new Promise<void>((resolve) => { finishAnswer = resolve; }),
    output: async () => "Continued answer", stop: async () => {}, archive: async () => {},
  } } });
  const store = createStore(bb);
  store.saveReview({ targetKey: "pr-1", kind: "pr", repo: "a/b", number: 1, status: "ready", createdAt: 1 });
  store.setLifecycle("pr-1", { prState: "MERGED", archivedAt: 123 });
  store.setAgentThread("pr-1", "deleted-worker");
  const cleanup = createReviewSync(bb, store, vi.fn()).one("pr-1");
  await vi.waitFor(() => expect(failUpdate).toBeTypeOf("function"));
  const answer = runAgentTurn(bb, store, { targetKey: "pr-1", projectId: "p1", message: "Continue" });
  expect(harness.inspection.sdk.callsTo("threads.get")).toHaveLength(0);
  failUpdate(new Error("HTTP 404: Thread not found"));
  await cleanup;
  await vi.waitFor(() => expect(finishAnswer).toBeTypeOf("function"));
  expect(store.getAgentThread("pr-1")).toBe("fresh-worker");
  expect(harness.inspection.sdk.callsTo("threads.spawn")).toHaveLength(1);
  finishAnswer();
  await expect(answer).resolves.toEqual({ answer: "Continued answer" });
  expect(store.getAgentThread("pr-1")).toBe("fresh-worker");
});
