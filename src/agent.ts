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
export function buildSeedPrompt(guide: Guide | null, targetKey: string): string {
  const lines = [
    "You are the review agent for a code change. Answer the reviewer's questions concisely and",
    "specifically, grounded in the diff they reference. When they select code or name a file, focus there.",
    `To read the full diff of any file across this review, call the read_review_patch tool with targetKey "${targetKey}".`,
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

/**
 * Extract exactly the lines a reviewer selected (by 1-based line number on the
 * new or old side) from a file's unified diff, keeping the +/-/space prefixes.
 * Walks each hunk tracking old/new line counters. Returns "" if nothing matches.
 */
export function extractSelectedLines(
  patch: string,
  file: string,
  start: number,
  end: number,
  side: "additions" | "deletions" = "additions",
): string {
  const f = splitPatchByFile(patch).find((x) => x.path === file);
  if (!f) return "";
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const wantOld = side === "deletions";
  const out: string[] = [];
  let oldLine = 0;
  let newLine = 0;
  for (const line of f.text.split("\n")) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      oldLine = Number(h[1]);
      newLine = Number(h[2]);
      continue;
    }
    if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) continue;
    const c = line[0];
    if (c === "+") {
      if (!wantOld && newLine >= lo && newLine <= hi) out.push(line);
      newLine++;
    } else if (c === "-") {
      if (wantOld && oldLine >= lo && oldLine <= hi) out.push(line);
      oldLine++;
    } else if (c === " ") {
      const n = wantOld ? oldLine : newLine;
      if (n >= lo && n <= hi) out.push(line);
      newLine++;
      oldLine++;
    }
    // else: blank / "\ No newline" / artifact — skip without counting.
  }
  return out.join("\n");
}

/** One reviewer turn: their question plus any file/selection context, inlined. */
export function buildTurnText(args: { message: string; context?: AgentMessageContext; patch: string }): string {
  const { message, context, patch } = args;
  if (!context?.file) return message;

  const lineRange =
    context.startLine != null
      ? ` lines ${context.startLine}${context.endLine != null && context.endLine !== context.startLine ? `-${context.endLine}` : ""}`
      : "";

  // Text highlight — the reviewer already handed us the exact code.
  if (context.code && context.code.trim()) {
    return `${message}\n\nThe reviewer highlighted this in ${context.file}${lineRange}:\n\`\`\`\n${context.code}\n\`\`\``;
  }

  // Line-range selection (gutter "+" / drag) — pull those exact lines from the
  // diff so the agent answers about the selection, not the whole file.
  if (context.startLine != null) {
    const snippet = extractSelectedLines(
      patch,
      context.file,
      context.startLine,
      context.endLine ?? context.startLine,
      context.side,
    ).slice(0, MAX_FILE_DIFF);
    if (snippet.trim()) {
      return `${message}\n\nThe reviewer selected ${context.file}${lineRange}. Focus on exactly these lines (use read_review_patch for surrounding context):\n\`\`\`diff\n${snippet}\n\`\`\``;
    }
    return `${message}\n\nThe reviewer is asking about ${context.file}${lineRange}. Use read_review_patch to read that region.`;
  }

  // Whole-file focus.
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
      prompt: `${buildSeedPrompt(guide, args.targetKey)}\n\n${turnText}`,
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
      prompt: buildSeedPrompt(store.getGuide(args.targetKey), args.targetKey),
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
