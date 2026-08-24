import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

// The RPC data plane between the panel (app.tsx) and the backend (server.ts).
// Extended task-by-task (reads, draft/submit, assist). app.tsx imports the TYPE
// of this contract only; the backend module never enters the frontend bundle.
const targetKey = z.object({ targetKey: z.string() }).strict();

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

  // Task 10: read data plane
  __seedForTest: {
    input: z.object({ targetKey: z.string(), patch: z.string() }).strict(),
    output: z.object({ ok: z.boolean() }),
  },
  listReviews: { input: z.null(), output: z.object({ reviews: z.array(z.any()) }) },
  getReview: { input: targetKey, output: z.object({ review: z.any().nullable() }) },
  getGuide: { input: targetKey, output: z.object({ guide: z.any().nullable(), status: z.string() }) },
  getPatch: { input: targetKey, output: z.object({ patch: z.string() }) },
  getPr: { input: targetKey, output: z.object({ pr: z.any().nullable() }) },
  getThreads: { input: targetKey, output: z.object({ comments: z.array(z.any()) }) },
  getChecks: { input: targetKey, output: z.object({ checks: z.string() }) },

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
});
