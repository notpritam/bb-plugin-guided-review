// @vitest-environment jsdom
import { test } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

test("review list renders rows from rpc", async () => {
  const app = await loadPluginApp(() => import("../app"));
  const slot = renderSlot(app.navPanels[0]!, { subPath: "" }, {
    rpc: {
      listReviews: () => ({ reviews: [{ targetKey: "pr-7", kind: "pr", number: 7, title: "Fix", status: "ready", createdAt: 1 }] }),
    },
  });
  await slot.findByText("Fix");
});
