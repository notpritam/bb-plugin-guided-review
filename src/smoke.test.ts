import { test, expect } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import plugin from "../server";

test("ping returns ok", async () => {
  const { bb, harness } = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(bb);
  const res = await harness.behavior.callRpc("ping", null);
  expect(res).toEqual({ ok: true });
});
