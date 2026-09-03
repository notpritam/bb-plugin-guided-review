import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Store, AgentMessageContext } from "./store";
import type { Guide } from "./guide";
import { splitPatchByFile } from "./patch";

interface AgentTurnArgs {
  targetKey: string;
  message: string;
  context?: AgentMessageContext;
  projectId: string;
}

const MAX_FILE_DIFF = 40_000;

/** The persistent thread's opening system-style preamble. */
export function buildSeedPrompt(guide: Guide | null): string {
  const lines = [
    "You are the review agent for a code change. Answer the reviewer's questions concisely and",
    "specifically, grounded in the diff they reference. When they select code or name a file, focus there.",
  ];
  if (guide) {
    lines.push("", `Change intent: ${guide.intent}`);
    if (guide.sections.length) {
      lines.push("Chapters:");
      for (const s of guide.sections) lines.push(`- ${s.title}: ${s.overview}`);
    }
  }
  return lines.join("\n");
}

/** One reviewer turn: their question plus any file/selection context, inlined. */
export function buildTurnText(args: { message: string; context?: AgentMessageContext; patch: string }): string {
  const { message, context, patch } = args;
  if (!context?.file) return message;

  const lineRange =
    context.startLine != null
      ? ` (lines ${context.startLine}${context.endLine != null && context.endLine !== context.startLine ? `-${context.endLine}` : ""})`
      : "";

  if (context.code && context.code.trim()) {
    return `${message}\n\nSelected from ${context.file}${lineRange}:\n\`\`\`\n${context.code}\n\`\`\``;
  }

  const scoped = splitPatchByFile(patch)
    .filter((f) => f.path === context.file)
    .map((f) => f.text)
    .join("\n")
    .slice(0, MAX_FILE_DIFF);
  if (!scoped.trim()) return `${message}\n\n(About ${context.file}.)`;
  return `${message}\n\nFocused file ${context.file}:\n\`\`\`diff\n${scoped}\n\`\`\``;
}

function normalizeOutput(res: unknown): string {
  const value =
    typeof res === "string"
      ? res
      : res && typeof res === "object" && "output" in res
        ? (res as { output: string | null }).output
        : res;
  return typeof value === "string" ? value : String(value ?? "");
}

/**
 * Run one turn against the review's persistent agent thread, creating and
 * seeding the thread on the first turn and reusing it (via threads.send)
 * thereafter. The in-panel chat log is the display source of truth; the thread
 * is the compute and the "Open as bb thread" target — so it is never archived.
 */
export async function runAgentTurn(bb: BbPluginApi, store: Store, args: AgentTurnArgs): Promise<{ answer: string }> {
  const guide = store.getGuide(args.targetKey);
  const patch = store.readPatch(args.targetKey, 0, 5_000_000).text;
  const turnText = buildTurnText({ message: args.message, context: args.context, patch });

  store.appendAgentMessage(args.targetKey, "user", args.message, args.context);

  let threadId = store.getAgentThread(args.targetKey);
  if (!threadId) {
    const worker = await bb.sdk.threads.spawn({
      projectId: args.projectId,
      environment: { type: "project-default" },
      prompt: `${buildSeedPrompt(guide)}\n\n${turnText}`,
      title: `Review agent: ${args.targetKey}`,
      visibility: "visible",
    });
    threadId = worker.id;
    store.setAgentThread(args.targetKey, threadId);
  } else {
    await bb.sdk.threads.send({
      threadId,
      mode: "auto",
      input: [{ type: "text", text: turnText, mentions: [] }],
    });
  }

  await bb.sdk.threads.wait({ threadId, status: "idle" });
  const answer = normalizeOutput(await bb.sdk.threads.output({ threadId }));
  store.appendAgentMessage(args.targetKey, "assistant", answer);
  return { answer };
}

/** Ensure the persistent thread exists and surface it in the bb client UI. */
export async function openAgentThread(
  bb: BbPluginApi,
  store: Store,
  args: { targetKey: string; projectId: string },
): Promise<{ threadId: string }> {
  let threadId = store.getAgentThread(args.targetKey);
  if (!threadId) {
    const worker = await bb.sdk.threads.spawn({
      projectId: args.projectId,
      environment: { type: "project-default" },
      prompt: buildSeedPrompt(store.getGuide(args.targetKey)),
      title: `Review agent: ${args.targetKey}`,
      visibility: "visible",
    });
    threadId = worker.id;
    store.setAgentThread(args.targetKey, threadId);
    await bb.sdk.threads.wait({ threadId, status: "idle" }).catch(() => {});
  }
  await bb.sdk.threads.open({ threadId, file: null }).catch(() => {});
  return { threadId };
}
