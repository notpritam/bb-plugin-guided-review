import { test, expect } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createStore } from "./store";
import { runAssist } from "./assist";

test("assist returns the worker thread's output", async () => {
  const { bb } = createFakePluginHost({
    pluginId: "guided-review",
    sdk: {
      threads: {
        spawn: async () => ({ id: "th_a" }),
        wait: async () => {},
        output: async () => "Because it schedules a refresh before expiry.",
        archive: async () => {},
        stop: async () => {},
      },
    },
  });
  const store = createStore(bb);
  const res = await runAssist(bb, store, { targetKey: "pr-1", question: "why?", projectId: "p1" });
  expect(res.answer).toContain("refresh");
});
