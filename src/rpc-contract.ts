import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

// The RPC data plane between the panel (app.tsx) and the backend (server.ts).
// Extended task-by-task (reads, draft/submit, viewed-state, agent). app.tsx imports the TYPE
// of this contract only; the backend module never enters the frontend bundle.
const targetKey = z.object({ targetKey: z.string() }).strict();

const agentContext = z
  .object({
    file: z.string().optional(),
    startLine: z.number().int().optional(),
    endLine: z.number().int().optional(),
    side: z.enum(["additions", "deletions"]).optional(),
    code: z.string().optional(),
    chapterId: z.string().optional(),
  })
  .strict();

const commentShape = z
  .object({
    file: z.string(),
    line: z.number().int(),
    side: z.enum(["LEFT", "RIGHT"]),
    chapterId: z.string().optional(),
    body: z.string().min(1),
  })
  .strict();

export const rpcContract = defineRpcContract({
  ping: { input: z.null(), output: z.object({ ok: z.boolean() }) },

  // Panel: start a review by pasting a GitHub PR URL
  startReview: {
    input: z.object({ input: z.string().min(1) }).strict(),
    output: z.object({ ok: z.boolean(), error: z.string().optional(), targetKey: z.string().optional() }),
  },

  // Task 10: read data plane
  listReviews: { input: z.null(), output: z.object({ reviews: z.array(z.any()) }) },
  getReview: { input: targetKey, output: z.object({ review: z.any().nullable() }) },
  getGuide: { input: targetKey, output: z.object({ guide: z.any().nullable(), status: z.string() }) },
  getPatch: { input: targetKey, output: z.object({ patch: z.string() }) },
  getPr: { input: targetKey, output: z.object({ pr: z.any().nullable() }) },
  getThreads: { input: targetKey, output: z.object({ comments: z.array(z.any()) }) },
  getChecks: { input: targetKey, output: z.object({ bucket: z.string(), checks: z.array(z.any()) }) },

  // Phase 2: review threads, reply/resolve, staleness, re-review
  getReviewThreads: { input: targetKey, output: z.object({ threads: z.array(z.any()) }) },
  replyToThread: {
    input: z.object({ targetKey: z.string(), inReplyTo: z.number().int(), body: z.string().min(1) }).strict(),
    output: z.object({ ok: z.boolean(), error: z.string().optional() }),
  },
  resolveThread: {
    input: z.object({ targetKey: z.string(), threadId: z.string() }).strict(),
    output: z.object({ ok: z.boolean(), error: z.string().optional() }),
  },
  unresolveThread: {
    input: z.object({ targetKey: z.string(), threadId: z.string() }).strict(),
    output: z.object({ ok: z.boolean(), error: z.string().optional() }),
  },
  checkForUpdates: {
    input: targetKey,
    output: z.object({ hasNewCommits: z.boolean(), current: z.string().optional(), stored: z.string().optional() }),
  },
  rereview: {
    input: targetKey,
    output: z.object({ ok: z.boolean(), error: z.string().optional() }),
  },

  // Task 11: draft + submit
  getDraft: { input: targetKey, output: z.object({ draft: z.any() }) },
  saveDraftComment: {
    input: z.object({ targetKey: z.string(), comment: commentShape }).strict(),
    output: z.object({ draft: z.any() }),
  },
  removeDraftComment: {
    input: z.object({ targetKey: z.string(), index: z.number().int().min(0) }).strict(),
    output: z.object({ draft: z.any() }),
  },
  setVerdict: {
    input: z
      .object({
        targetKey: z.string(),
        verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]),
        body: z.string(),
      })
      .strict(),
    output: z.object({ draft: z.any() }),
  },
  submitReview: { input: targetKey, output: z.object({ ok: z.boolean(), error: z.string().optional() }) },

  // Feature 1: per-file "Viewed" state
  getFileViews: {
    input: targetKey,
    output: z.object({
      views: z.array(z.object({ file: z.string(), viewed: z.boolean(), stale: z.boolean() })),
    }),
  },
  setFileViewed: {
    input: z.object({ targetKey: z.string(), file: z.string(), viewed: z.boolean() }).strict(),
    output: z.object({ ok: z.boolean() }),
  },

  // Feature 3: floating review agent (persistent thread + in-panel chat log)
  getAgentMessages: { input: targetKey, output: z.object({ messages: z.array(z.any()) }) },
  askAgent: {
    input: z
      .object({
        targetKey: z.string(),
        message: z.string().min(1),
        context: agentContext.optional(),
      })
      .strict(),
    output: z.object({ answer: z.string() }),
  },
  openAgentThread: { input: targetKey, output: z.object({ threadId: z.string() }) },

  // GitHub account indicator + switcher
  getGhAccounts: {
    input: z.null(),
    output: z.object({
      active: z.string().nullable(),
      accounts: z.array(z.object({ login: z.string(), active: z.boolean() })),
    }),
  },
  switchGhAccount: {
    input: z.object({ login: z.string().min(1) }).strict(),
    output: z.object({ ok: z.boolean(), active: z.string().nullable(), error: z.string().optional() }),
  },
  checkRepoAccess: {
    input: z.object({ targetKey: z.string() }).strict(),
    output: z.object({ accessible: z.boolean(), repo: z.string().nullable(), account: z.string().nullable() }),
  },
});
