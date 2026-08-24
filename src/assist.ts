import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store } from "./store";
import { splitPatchByFile } from "./patch";

interface AssistArgs {
  targetKey: string;
  chapterId?: string;
  file?: string;
  question: string;
  projectId: string;
}

export async function runAssist(bb: BbPluginApi, store: Store, args: AssistArgs): Promise<{ answer: string }> {
  const guide = store.getGuide(args.targetKey);
  const patch = store.readPatch(args.targetKey, 0, 5_000_000).text;
  const files = splitPatchByFile(patch);
  const scoped = args.file ? files.filter((f) => f.path === args.file) : files;
  const chapter = guide?.sections.find((s) => s.id === args.chapterId);

  const prompt = [
    "You are helping review a code change. Answer the reviewer's question concisely.",
    guide ? `Change intent: ${guide.intent}` : "",
    chapter ? `Chapter "${chapter.title}": ${chapter.overview}` : "",
    "Relevant diff:",
    "```diff",
    scoped.map((f) => f.text).join("\n").slice(0, 60_000),
    "```",
    `Question: ${args.question}`,
  ].filter(Boolean).join("\n");

  const worker = await bb.sdk.threads.spawn({
    projectId: args.projectId,
    environment: { type: "project-default" },
    prompt,
    title: `Assist: ${args.targetKey}`,
    visibility: "hidden",
  });
  try {
    await bb.sdk.threads.wait({ threadId: worker.id, status: "idle" });
    // The real SDK resolves { output: string | null }; some test doubles
    // stub `output` to resolve the string directly. Accept both shapes.
    const res: unknown = await bb.sdk.threads.output({ threadId: worker.id });
    const answer =
      typeof res === "string"
        ? res
        : res && typeof res === "object" && "output" in res
          ? (res as { output: string | null }).output
          : res;
    return { answer: typeof answer === "string" ? answer : String(answer ?? "") };
  } finally {
    await bb.sdk.threads.archive({ threadId: worker.id }).catch(() => {});
    await bb.sdk.threads.stop({ threadId: worker.id }).catch(() => {});
  }
}
