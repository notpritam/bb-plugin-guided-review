import { expect, test, vi } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createPluginUpdates } from "./plugin-updates";

function setup() {
  let now = 1_000_000;
  const check = vi.fn(async () => [{ id: "guided-review", outcome: "update-available", installed: { display: "0.2.0", version: "old" }, candidate: { display: "0.2.1", version: "new" } }]);
  const apply = vi.fn(async () => ({ outcome: "updated", applied: true, from: { display: "0.2.0", version: "old" }, to: { display: "0.2.1", version: "new" } }));
  const { bb } = createFakePluginHost({ pluginId: "guided-review", sdk: { plugins: { checkUpdates: check, applyUpdate: apply } } });
  const updates = createPluginUpdates(bb, () => false, () => now);
  return { bb, updates, check, apply, advance: () => { now += 3_600_001; } };
}

test("automatic updates default off, persist opt-in, and wait for open views to close", async () => {
  const { bb, updates, check, apply, advance } = setup();
  advance(); await updates.tick(); expect(check).not.toHaveBeenCalled();
  updates.setAutomatic(true);
  expect(createPluginUpdates(bb, () => false).status().automatic).toBe(true);
  updates.presence("review-tab", true); advance(); await updates.tick(); expect(apply).not.toHaveBeenCalled();
  updates.presence("review-tab", false); advance(); await updates.tick(); expect(apply).toHaveBeenCalledTimes(1);
});

test("manual update blocks concurrent work and other review windows without expiring their protection", async () => {
  const { updates, apply, advance } = setup();
  updates.presence("settings", true); updates.presence("review", true); advance();
  await expect(updates.apply("settings", "new")).rejects.toThrow(/close/i);
  updates.presence("review", false);
  let finish!: () => void;
  const work = updates.run(() => new Promise<void>(resolve => { finish = resolve; }));
  await expect(updates.apply("settings", "new")).rejects.toThrow(/finish/i);
  finish(); await work;
  await updates.apply("settings", "new"); expect(apply).toHaveBeenCalledTimes(1);
});

test("an update reserves the runtime before checking and rejects new mutations", async () => {
  const { updates, check } = setup(); let finish!: (result: any) => void;
  check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const applying = updates.apply("settings", "new");
  await expect(updates.run(async () => 1)).rejects.toThrow(/updat/i);
  expect(() => updates.presence("new-review", true)).toThrow(/updat/i);
  finish([{ id: "guided-review", outcome: "current", installed: { display: "0.2.0", version: "old" } }]);
  await expect(applying).rejects.toThrow(/changed|available/i);
});

test("errors stay visible and retries are delayed; a disabled opt-in cancels pending automatic work", async () => {
  const { updates, check, apply, advance } = setup(); updates.setAutomatic(true); advance();
  check.mockRejectedValueOnce(new Error("offline")); await updates.tick();
  expect(updates.status().error).toMatch(/check/i); await updates.tick(); expect(check).toHaveBeenCalledTimes(1);
  advance(); let finish!: (result: any) => void;
  check.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const tick = updates.tick(); updates.setAutomatic(false);
  finish([{ id: "guided-review", outcome: "update-available", installed: { display: "0.2.0", version: "old" }, candidate: { display: "0.2.1", version: "new" } }]);
  await tick; expect(apply).not.toHaveBeenCalled();
});
