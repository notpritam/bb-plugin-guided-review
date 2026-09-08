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
import { createPrReview } from "./src/start-review";
import { runAgentTurn, openAgentThread } from "./src/agent";
import { computeFileViewState, hashForFile } from "./src/file-views";
import {
  ghPrViewArgs,
  ghPrCommentsArgs,
  ghPrChecksJsonArgs,
  ghReviewThreadsArgs,
  ghReplyThreadArgs,
  ghResolveThreadArgs,
  ghUnresolveThreadArgs,
  ghPrHeadArgs,
  runGh,
  runGit,
  ghErrorMessage,
} from "./src/gh";
import { createReviewSubmitter } from "./src/submit-review";
import { stopGuideGenerations } from "./src/generate";
import { parseChecks, parseReviewThreads } from "./src/threads";
import { rerunReview } from "./src/rereview";
import { getGhAccounts, switchGhAccount, checkRepoAccess } from "./src/gh-accounts";

export { rpcContract } from "./src/rpc-contract";

export default async function plugin(bb: BbPluginApi) {
  const store = createStore(bb);
  store.interruptGenerations();
  const submitReview = createReviewSubmitter(store, runGh);
  bb.onDispose(() => stopGuideGenerations(bb));

  bb.log.info("guided-review loaded");

  bb.rpc.register(rpcContract, {
    ping() {
      return { ok: true };
    },

    // Panel: start a review by pasting a GitHub PR URL. The nav panel isn't
    // project-scoped, so the frontend can't reliably supply a projectId —
    // resolve one server-side (prefer the personal project, else the first).
    async startReview({ input }) {
      let projectId: string | undefined;
      try {
        const projects = await bb.sdk.projects.list({ includePersonal: true });
        const personal = projects.find((p) => p.kind === "personal");
        projectId = (personal ?? projects[0])?.id;
      } catch {
        return { ok: false, error: "Could not resolve a project to run generation." };
      }
      if (!projectId) return { ok: false, error: "No project available to run generation." };
      return createPrReview({ bb, store, gh: { runGh, runGit } }, { input, projectId });
    },

    // Task 10: read data plane
    listReviews() {
      // ReviewMeta rows carry optional fields as literal `undefined` own
      // properties (store.ts's rowToMeta), which the rpc layer's strict JSON
      // output check rejects; round-trip through JSON to drop them.
      return { reviews: JSON.parse(JSON.stringify(store.listReviews())) };
    },
    getReview({ targetKey }) {
      return { review: JSON.parse(JSON.stringify(store.getReview(targetKey))) };
    },
    getGuide({ targetKey }) {
      return { guide: store.getGuide(targetKey), status: store.getReview(targetKey)?.status ?? "error" };
    },
    getPatch({ targetKey }) {
      const total = store.readPatch(targetKey, 0, 0).total;
      return { patch: store.readPatch(targetKey, 0, total).text };
    },
    async getPr({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number) return { pr: null };
      const r = await runGh(ghPrViewArgs(m.number, m.repo));
      return { pr: r.code === 0 ? JSON.parse(r.stdout) : null };
    },
    async getThreads({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number || !m.repo) return { comments: [] };
      const r = await runGh(ghPrCommentsArgs(m.repo, m.number));
      return { comments: r.code === 0 ? JSON.parse(r.stdout) : [] };
    },
    async getChecks({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number) return { bucket: "none", checks: [] };
      const r = await runGh(ghPrChecksJsonArgs(m.number, m.repo));
      const parsed = parseChecks([0, 1, 8].includes(r.code) ? r.stdout : "");
      return { bucket: parsed.bucket, checks: parsed.checks };
    },

    // Phase 2: review threads, reply/resolve, staleness, re-review
    async getReviewThreads({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number || !m.repo) return { threads: [] };
      const [owner, repo] = m.repo.split("/");
      const r = await runGh(ghReviewThreadsArgs(owner, repo, m.number));
      return { threads: parseReviewThreads(r.code === 0 ? r.stdout : "").threads };
    },
    async replyToThread({ targetKey, inReplyTo, body }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number || !m.repo) return { ok: false, error: "Not a PR." };
      const r = await runGh(ghReplyThreadArgs(m.repo, m.number, inReplyTo), { stdin: JSON.stringify({ body }) });
      return r.code === 0 ? { ok: true } : { ok: false, error: ghErrorMessage(r) };
    },
    async resolveThread({ threadId }) {
      const r = await runGh(ghResolveThreadArgs(threadId));
      return r.code === 0 ? { ok: true } : { ok: false, error: ghErrorMessage(r) };
    },
    async unresolveThread({ threadId }) {
      const r = await runGh(ghUnresolveThreadArgs(threadId));
      return r.code === 0 ? { ok: true } : { ok: false, error: ghErrorMessage(r) };
    },
    async checkForUpdates({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m || m.kind !== "pr" || !m.number) return { hasNewCommits: false };
      const r = await runGh(ghPrHeadArgs(m.number, m.repo));
      if (r.code !== 0) return { hasNewCommits: false };
      let head: any;
      try {
        head = JSON.parse(r.stdout);
      } catch {
        return { hasNewCommits: false };
      }
      if (typeof head?.headRefOid !== "string") return { hasNewCommits: false };
      return { hasNewCommits: !!m.headSha && head.headRefOid !== m.headSha, current: head.headRefOid, ...(m.headSha ? { stored: m.headSha } : {}) };
    },
    async rereview({ targetKey }) {
      return rerunReview({ bb, store, gh: { runGh, runGit } }, targetKey);
    },

    // Task 11: draft + submit
    getDraft({ targetKey }) {
      return { draft: store.getDraft(targetKey) };
    },
    saveDraftComment({ targetKey, comment }) {
      return { draft: store.upsertDraftComment(targetKey, comment) };
    },
    removeDraftComment({ targetKey, index }) {
      return { draft: store.removeDraftComment(targetKey, index) };
    },
    setVerdict({ targetKey, verdict, body }) {
      return { draft: store.setVerdict(targetKey, verdict, body) };
    },
    async submitReview({ targetKey }) {
      return submitReview(targetKey);
    },

    // Feature 1: per-file "Viewed" state (viewed/stale computed against the patch)
    getFileViews({ targetKey }) {
      const total = store.readPatch(targetKey, 0, 0).total;
      const patch = store.readPatch(targetKey, 0, total).text;
      return { views: computeFileViewState(store.getFileViews(targetKey), patch) };
    },
    setFileViewed({ targetKey, file, viewed }) {
      if (!viewed) {
        store.unsetFileViewed(targetKey, file);
        return { ok: true };
      }
      const total = store.readPatch(targetKey, 0, 0).total;
      const hash = hashForFile(store.readPatch(targetKey, 0, total).text, file);
      if (!hash) return { ok: false };
      store.setFileViewed(targetKey, file, hash);
      return { ok: true };
    },

    // Feature 3: floating review agent
    getAgentMessages({ targetKey }) {
      return { messages: store.listAgentMessages(targetKey) };
    },
    async askAgent({ targetKey, message, context }) {
      const m = store.getReview(targetKey);
      if (!m?.projectId) {
        return { answer: "This review has no associated project; re-run `bb review` inside a project." };
      }
      const res = await runAgentTurn(bb, store, { targetKey, message, context, projectId: m.projectId });
      bb.realtime.publish(`agent:${targetKey}`, { ts: Date.now() });
      return res;
    },
    async openAgentThread({ targetKey }) {
      const m = store.getReview(targetKey);
      if (!m?.projectId) throw new Error("This review has no associated project.");
      return openAgentThread(bb, store, { targetKey, projectId: m.projectId });
    },

    // GitHub account indicator + switcher
    async getGhAccounts() {
      return getGhAccounts(runGh);
    },
    async switchGhAccount({ login }) {
      const r = await switchGhAccount(runGh, login);
      if (r.ok) bb.realtime.publish("gh-account", { active: r.active });
      return r;
    },
    async checkRepoAccess({ targetKey }) {
      const repo = store.getReview(targetKey)?.repo ?? null;
      return checkRepoAccess(runGh, repo);
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
    parameters: z.object({ targetKey: z.string(), generationId: z.string(), guide: z.unknown() }),
    async execute({ targetKey, generationId, guide }) {
      if (!store.isCurrentGeneration(targetKey, generationId) || store.getReview(targetKey)?.status !== "generating") {
        return { content: [{ type: "text", text: "This generation was superseded or interrupted. Do not overwrite the current review." }], isError: true };
      }
      const v = validateGuide(guide);
      if (!v.ok) return { content: [{ type: "text", text: "Invalid guide:\n" + v.errors.join("\n") }], isError: true };
      const total = store.readPatch(targetKey, 0, 0).total;
      const files = changedFiles(store.readPatch(targetKey, 0, total).text);
      const cov = checkCoverage(v.guide, files);
      if (!cov.ok) return { content: [{ type: "text", text: "Coverage errors:\n" + cov.errors.join("\n") }], isError: true };
      // Stamp the store's authoritative gitRef/base over whatever the agent
      // submitted — the guide must never carry a wrong or stale review ref.
      const meta = store.getReview(targetKey);
      if (meta?.gitRef) v.guide.review = { gitRef: meta.gitRef, ...(meta.base ? { base: meta.base } : {}) };
      store.saveGuide(targetKey, v.guide);
      return "Guide accepted.";
    },
  });

  // Only expose these tools to THIS plugin's own spawned generation thread.
  // Both the generation thread and the review-agent thread are spawned by this
  // plugin (origin.pluginId matches for both), so the origin check alone is
  // not enough — gate on the generation thread's distinctive title too. The
  // review-agent thread ("Review agent: …") answers from inlined context and
  // intentionally gets no tools.
  bb.agents.configure((context) => {
    if (context.origin?.pluginId !== bb.pluginId) return { tools: [], skills: [] };
    const title = context.thread?.title ?? "";
    if (title.startsWith("Generate guide:")) {
      return { tools: ["read_review_patch", "generate_review_guide"], skills: ["guided-review-generate"] };
    }
    // The floating review-agent thread can read any file's diff on demand, so
    // the chat works across the whole review — but it never gets the
    // guide-writing tool or the generation skill.
    if (title.startsWith("Review agent:")) {
      return { tools: ["read_review_patch"], skills: [] };
    }
    return { tools: [], skills: [] };
  });

  bb.cli.register({
    name: "review",
    summary: "Open a Guided Review of a GitHub PR or local git ref",
    commands: [{ name: "review", summary: "Review a PR or ref", usage: "bb review <pr-url | pr-number | git-ref> [--base <ref>]" }],
    async run(argv, ctx) {
      return runReviewCommand({ bb, store, gh: { runGh, runGit } }, argv, ctx);
    },
  });
}
