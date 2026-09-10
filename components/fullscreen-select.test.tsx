// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
afterEach(() => { cleanup(); Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null }); });
HTMLElement.prototype.scrollIntoView = () => {};
test("an open verdict menu is inside the fullscreen element", async () => {
  const workspace = document.createElement("div");
  document.body.appendChild(workspace);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: workspace });
  render(<Select open value="COMMENT"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COMMENT">Comment</SelectItem><SelectItem value="APPROVE">Approve</SelectItem></SelectContent></Select>, { container: workspace });
  const menu = await screen.findByRole("listbox");
  expect(workspace.contains(menu)).toBe(true);
  workspace.remove();
});
