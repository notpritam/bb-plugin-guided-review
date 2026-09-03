// @vitest-environment jsdom
//
// AgentDock uses useRpc/useRealtime, so it must be imported dynamically after
// the test plugin runtime is installed (same reason as ThreadsPanel.test.tsx).
// It portals into document.body, so queries go through `screen`.
import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { installTestPluginRuntime, renderSlot } from "@get-bb/plugin-sdk/testing/app";

installTestPluginRuntime();
afterEach(cleanup);
beforeEach(() => localStorage.clear());

test("opens from the FAB and lists nothing initially", async () => {
  const { AgentDock } = await import("./AgentDock");
  renderSlot(
    { component: AgentDock },
    { targetKey: "pr-1", currentFile: "src/a.ts", currentChapterId: "c1" },
    { rpc: { getAgentMessages: () => ({ messages: [] }) } as any },
  );
  fireEvent.click(screen.getByLabelText("Ask the review agent"));
  await screen.findByRole("dialog");
  expect(screen.getByText(/Ask about this change/)).toBeTruthy();
});

test("sending a message calls askAgent with the current-file context", async () => {
  const { AgentDock } = await import("./AgentDock");
  const askAgent = vi.fn(() => ({ answer: "ok" }));
  renderSlot(
    { component: AgentDock },
    { targetKey: "pr-1", currentFile: "src/a.ts", currentChapterId: "c1" },
    { rpc: { getAgentMessages: () => ({ messages: [] }), askAgent } as any },
  );
  fireEvent.click(screen.getByLabelText("Ask the review agent"));
  fireEvent.change(await screen.findByPlaceholderText(/Ask the agent/), { target: { value: "is this safe?" } });
  fireEvent.click(screen.getByLabelText("Send"));
  await vi.waitFor(() =>
    expect(askAgent).toHaveBeenCalledWith({
      targetKey: "pr-1",
      message: "is this safe?",
      context: { file: "src/a.ts", chapterId: "c1" },
    }),
  );
});

test("the header link opens the underlying bb thread", async () => {
  const { AgentDock } = await import("./AgentDock");
  const openAgentThread = vi.fn(() => ({ threadId: "th_1" }));
  renderSlot(
    { component: AgentDock },
    { targetKey: "pr-1" },
    { rpc: { getAgentMessages: () => ({ messages: [] }), openAgentThread } as any },
  );
  fireEvent.click(screen.getByLabelText("Ask the review agent"));
  fireEvent.click(await screen.findByText("Open as thread"));
  await vi.waitFor(() => expect(openAgentThread).toHaveBeenCalledWith({ targetKey: "pr-1" }));
});
