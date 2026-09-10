// @vitest-environment jsdom
import { test, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, screen, fireEvent } from "@testing-library/react";
import { installTestPluginRuntime, renderSlot } from "@get-bb/plugin-sdk/testing/app";

installTestPluginRuntime();
afterEach(cleanup);
beforeEach(() => localStorage.clear());

test("the assistant starts in the review panel, with an optional widget", async () => {
  const { AgentDock } = await import("./AgentDock");
  renderSlot({ component: AgentDock }, { targetKey: "pr-1" }, { rpc: { getAgentMessages: () => ({ messages: [] }) } });
  await screen.findByText("Ask about this change.");
  expect(screen.getByRole("region", { name: "Review assistant" })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Open assistant as widget" })).toBeTruthy();
  expect(screen.queryByText("Open as thread")).toBeNull();
});

test("a draft question and selection survive popping out and docking, including fullscreen", async () => {
  const { AgentDock } = await import("./AgentDock");
  const container = document.createElement("div"); document.body.appendChild(container);
  const onDock = vi.fn();
  const slot = renderSlot({ component: AgentDock }, { targetKey: "pr-1", container, currentFile: "src/a.ts", currentChapterId: "c1", onDock }, { rpc: { getAgentMessages: () => ({ messages: [] }) } });
  await screen.findByText("Ask about this change.");
  fireEvent.change(screen.getByRole("textbox", { name: "Ask the agent" }), { target: { value: "Is this safe?" } });
  fireEvent.click(screen.getByRole("button", { name: "Open assistant as widget" }));
  const widget = await screen.findByRole("dialog", { name: "Review agent" });
  expect(container.contains(widget)).toBe(true);
  expect((screen.getByRole("textbox", { name: "Ask the agent" }) as HTMLTextAreaElement).value).toBe("Is this safe?");
  fireEvent.click(widget.querySelector('[aria-label="Dock in review panel"]')!);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect((screen.getByRole("textbox", { name: "Ask the agent" }) as HTMLTextAreaElement).value).toBe("Is this safe?");
  expect(screen.getByText("a.ts")).toBeTruthy();
  expect(onDock).toHaveBeenCalledOnce();
  slot.lifecycle.unmount(); container.remove();
});

test("moving a pending answer between panel and widget does not send it twice", async () => {
  const { AgentDock } = await import("./AgentDock");
  let resolve!: (value: { answer: string }) => void;
  const askAgent = vi.fn(() => new Promise<{ answer: string }>((done) => { resolve = done; }));
  renderSlot({ component: AgentDock }, { targetKey: "pr-1", currentFile: "src/a.ts", currentChapterId: "c1" }, { rpc: { getAgentMessages: () => ({ messages: [] }), askAgent } });
  fireEvent.change(await screen.findByRole("textbox", { name: "Ask the agent" }), { target: { value: "Is this safe?" } });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask the agent" }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Ask the agent" }), { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Open assistant as widget" }));
  await screen.findByRole("dialog");
  expect(screen.getByText("Thinking…")).toBeTruthy();
  await vi.waitFor(() => expect(askAgent).toHaveBeenCalledExactlyOnceWith({ targetKey: "pr-1", message: "Is this safe?", context: { file: "src/a.ts", chapterId: "c1" } }));
  resolve({ answer: "ok" });
  await vi.waitFor(() => expect(screen.queryByText("Thinking…")).toBeNull());
});

test("a failed transcript refresh after successful sending does not restore the sent question", async () => {
  const { AgentDock } = await import("./AgentDock");
  const history = vi.fn().mockResolvedValueOnce({ messages: [] }).mockRejectedValue(new Error("offline"));
  const askAgent = vi.fn(async () => ({ answer: "Saved answer" }));
  renderSlot({ component: AgentDock }, { targetKey: "pr-1" }, { rpc: { getAgentMessages: history, askAgent } });
  await screen.findByText("Ask about this change.");
  fireEvent.change(screen.getByRole("textbox", { name: "Ask the agent" }), { target: { value: "A question" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("alert");
  expect((screen.getByRole("textbox", { name: "Ask the agent" }) as HTMLTextAreaElement).value).toBe("");
  expect(askAgent).toHaveBeenCalledOnce();
});
