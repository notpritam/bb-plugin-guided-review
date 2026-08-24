import { ReviewList } from "./ReviewList";
import { ReviewWorkspace } from "./ReviewWorkspace";

// NOTE: not wrapped in memo() — the plugin SDK's slot registration requires
// `component` to be a plain function (`typeof value === "function"`); a
// memo()-wrapped component is an object and is rejected both by the testing
// harness and by the production plugin-app-collector.
export function ReviewPanel({ subPath }: { subPath: string }) {
  const targetKey = subPath.split("/")[0] ?? "";
  return targetKey ? <ReviewWorkspace targetKey={targetKey} /> : <ReviewList />;
}
ReviewPanel.displayName = "ReviewPanel";
