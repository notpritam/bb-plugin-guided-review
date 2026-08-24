// bb-plugin-guided-review — frontend entry.
//
// Registers the "Guided Review" navPanel (a sidebar entry + its own route).
// The panel routes by subPath: "" renders the review list, anything else
// renders the chapter/diff workspace for that target.
import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { ReviewPanel } from "./components/ReviewPanel";

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "review",
    title: "Guided Review",
    icon: "GitPullRequest",
    path: "review",
    component: ReviewPanel,
  });
});
