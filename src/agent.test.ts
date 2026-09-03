import { test, expect } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createStore } from "./store";
import { runAgentTurn, buildSeedPrompt, buildTurnText, extractSelectedLines } from "./agent";

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
