import { test, expect } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";

test("seed then read", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(bb);
  await harness.behavior.callRpc("__seedForTest", { targetKey: "pr-1", patch: "diff --git a/a.ts b/a.ts\n" });
  const list = await harness.behavior.callRpc("listReviews", null);
  expect((list as any).reviews.map((r: any) => r.targetKey)).toContain("pr-1");
  const p = await harness.behavior.callRpc("getPatch", { targetKey: "pr-1" });
  expect((p as any).patch).toContain("diff --git");
});
