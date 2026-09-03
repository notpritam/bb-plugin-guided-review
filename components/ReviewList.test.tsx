// @vitest-environment jsdom
import { test } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

test("review list renders a card with title and status from rpc", async () => {
  const app = await loadPluginApp(() => import("../app"));
  const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
    rpc: {
      listReviews: () => ({
        reviews: [{ targetKey: "pr-7", kind: "pr", number: 7, repo: "acme/app", title: "Fix", author: "alice", status: "ready", createdAt: 1 }],
      }),
    },
  });
  // Card surfaces the title and its ready-status pill once the list resolves.
  await slot.findByText("Fix");
  await slot.findByText("Ready");
});
