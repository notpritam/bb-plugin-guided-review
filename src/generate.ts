import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "./store";

export function buildGenerationPrompt(targetKey: string): string {
  return [
    "Author a Guided Review for this change.",
    "Follow the guided-review-generate skill exactly.",
    `The target key is: ${targetKey}`,
    "Start by calling read_review_patch, then submit with generate_review_guide.",
  ].join("\n");
}

export async function generateGuide(
  bb: BbPluginApi,
  store: Store,
  targetKey: string,
  projectId: string,
): Promise<void> {
  const worker = await bb.sdk.threads.spawn({
    projectId,
    environment: { type: "project-default" },
    prompt: buildGenerationPrompt(targetKey),
    title: `Generate guide: ${targetKey}`,
    visibility: "hidden",
  });
  try {
    await bb.sdk.threads.wait({ threadId: worker.id, status: "idle" });
  } finally {
    await bb.sdk.threads.archive({ threadId: worker.id }).catch(() => {});
    await bb.sdk.threads.stop({ threadId: worker.id }).catch(() => {});
  }
  const ok = store.getGuide(targetKey) !== null;
  store.setStatus(targetKey, ok ? "ready" : "error");
  bb.realtime.publish(`review:${targetKey}`, { status: ok ? "ready" : "error" });
}
