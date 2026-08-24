// bb-plugin-guided-review — backend entry.
//
// Turns a GitHub PR (or local git ref) into an agent-authored chaptered
// walkthrough, rendered and reviewed in a bb panel, submitted back to GitHub.
// This factory is extended task-by-task (store, cli, tools, rpc, realtime).
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { rpcContract } from "./src/rpc-contract";
import { createStore } from "./src/store";
import { changedFiles } from "./src/patch";
import { validateGuide, checkCoverage } from "./src/guide";
import { runReviewCommand } from "./src/review-command";
import { runGh, runGit } from "./src/gh";

export { rpcContract } from "./src/rpc-contract";

export default async function plugin(bb: BbPluginApi) {
  const store = createStore(bb);

  bb.log.info("guided-review loaded");

  bb.rpc.register(rpcContract, {
    ping() {
      return { ok: true };
    },
  });

  bb.agents.registerTool({
    name: "read_review_patch",
    description: "Return the diff text for a Guided Review target (paginated).",
    parameters: z.object({
      targetKey: z.string(),
      offset: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(200_000).optional(),
    }),
    async execute({ targetKey, offset, limit }) {
      const { text, total } = store.readPatch(targetKey, offset, limit);
      const end = (offset ?? 0) + text.length;
      const more = end < total ? `\n\n[${end}/${total} bytes — call again with offset=${end}]` : "";
      return text + more;
    },
  });

  bb.agents.registerTool({
    name: "generate_review_guide",
    description: "Submit the authored guide. Validates shape and coverage.",
    parameters: z.object({ targetKey: z.string(), guide: z.unknown() }),
    async execute({ targetKey, guide }) {
      const v = validateGuide(guide);
      if (!v.ok) return { content: [{ type: "text", text: "Invalid guide:\n" + v.errors.join("\n") }], isError: true };
      const files = changedFiles(store.readPatch(targetKey, 0, 5_000_000).text);
      const cov = checkCoverage(v.guide, files);
      if (!cov.ok) return { content: [{ type: "text", text: "Coverage errors:\n" + cov.errors.join("\n") }], isError: true };
      store.saveGuide(targetKey, v.guide);
      return "Guide accepted.";
    },
  });

  // Only expose these tools to THIS plugin's own spawned generation thread.
  bb.agents.configure((context) =>
    context.origin?.pluginId === bb.pluginId
      ? { tools: ["read_review_patch", "generate_review_guide"], skills: ["guided-review-generate"] }
      : { tools: [], skills: [] },
  );

  bb.cli.register({
    name: "review",
    summary: "Open a Guided Review of a GitHub PR or local git ref",
    commands: [{ name: "review", summary: "Review a PR or ref", usage: "bb review <pr-url | pr-number | git-ref> [--base <ref>]" }],
    async run(argv, ctx) {
      return runReviewCommand({ bb, store, gh: { runGh, runGit } }, argv, ctx);
    },
  });
}
