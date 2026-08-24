import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

// The RPC data plane between the panel (app.tsx) and the backend (server.ts).
// Extended task-by-task (reads, draft/submit, assist). app.tsx imports the TYPE
// of this contract only; the backend module never enters the frontend bundle.
export const rpcContract = defineRpcContract({
  ping: { input: z.null(), output: z.object({ ok: z.boolean() }) },
});
