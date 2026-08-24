// bb-plugin-guided-review — frontend entry.
//
// Registers the "Guided Review" navPanel (a sidebar entry + its own route).
// The panel body is a placeholder until Tasks 13-15 build the real
// list + chapter/diff workspace; this exists so the panel is clickable now.
import { memo } from "react";
import { definePluginApp } from "@get-bb/plugin-sdk/app";

const ReviewPanel = memo(function ReviewPanel(_props: { subPath: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-6">
      <h2 className="text-lg font-semibold text-foreground">Guided Review</h2>
      <p className="text-sm text-muted-foreground">
        Start a review from a project thread. In that thread's terminal, run:
      </p>
      <pre className="rounded-md border border-border bg-card p-3 text-sm text-foreground">
        bb review &lt;pr-url | pr-number | git-ref&gt;
      </pre>
      <p className="text-sm text-muted-foreground">
        The chaptered walkthrough and diffs will render here. The interactive
        panel (chapters, diff viewer, comments, submit) is being built out.
      </p>
    </div>
  );
});
ReviewPanel.displayName = "ReviewPanel";

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "review",
    title: "Guided Review",
    icon: "GitPullRequest",
    path: "review",
    component: ReviewPanel,
  });
});
