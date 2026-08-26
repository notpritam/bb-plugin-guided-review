// @vitest-environment jsdom
//
// RereviewBanner imports hooks (useRpc, useRealtime) from "@get-bb/plugin-sdk/app",
// which bind to `globalThis.__bbPluginRuntime.pluginSdkApp` at module-evaluation
// time. A static `import { RereviewBanner } from "./RereviewBanner"` at the top of
// this file would pull that module in (via the import graph) before
// `installTestPluginRuntime()` ever runs, leaving the hooks permanently unbound.
// So: install the runtime first, then dynamically `import("./RereviewBanner")`
// inside each test (mirrors loadPluginApp's thunk pattern; see ThreadsPanel.test.tsx).
import { test, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { installTestPluginRuntime, renderSlot } from "@get-bb/plugin-sdk/testing/app";

installTestPluginRuntime();

// vitest.config.ts does not enable `test.globals`, so @testing-library/react's
// automatic afterEach(cleanup) (which relies on detecting a global `afterEach`)
// never registers. Without this, each test's render stays mounted and later
// queries see stale DOM from earlier tests in this file.
afterEach(cleanup);

test("re-checks staleness on the review realtime signal and hides the banner once resolved", async () => {
  const { RereviewBanner } = await import("./RereviewBanner");
  const checkForUpdates = vi
    .fn()
    .mockReturnValueOnce({ hasNewCommits: true })
    .mockReturnValue({ hasNewCommits: false });
  const slot = renderSlot(
    { component: RereviewBanner },
    { targetKey: "pr-1" },
    { rpc: { checkForUpdates } as any },
  );

  // Initial mount check reports new commits — banner shows.
  await slot.findByText(/New commits on this PR/);

  // Re-review completes and the guide-rebuild publishes review:<targetKey>.
  // The banner should re-check and, since the stored head now matches, hide.
  await slot.emitRealtime("review:pr-1", {});

  await vi.waitFor(() => expect(checkForUpdates).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(slot.queryByText(/New commits on this PR/)).toBeNull());
});

test("clicking Re-review calls the rereview rpc", async () => {
  const { RereviewBanner } = await import("./RereviewBanner");
  const checkForUpdates = vi.fn(() => ({ hasNewCommits: false }));
  const rereview = vi.fn(() => ({ ok: true }));
  const slot = renderSlot(
    { component: RereviewBanner },
    { targetKey: "pr-1" },
    { rpc: { checkForUpdates, rereview } as any },
  );

  await vi.waitFor(() => expect(checkForUpdates).toHaveBeenCalledWith({ targetKey: "pr-1" }));

  fireEvent.click(slot.getByText("Re-review"));

  await vi.waitFor(() => expect(rereview).toHaveBeenCalledWith({ targetKey: "pr-1" }));
});
