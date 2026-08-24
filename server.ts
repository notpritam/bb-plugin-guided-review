// bb-plugin-guided-review — backend entry.
//
// Turns a GitHub PR (or local git ref) into an agent-authored chaptered
// walkthrough, rendered and reviewed in a bb panel, submitted back to GitHub.
// This factory is extended task-by-task (store, cli, tools, rpc, realtime).
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { rpcContract } from "./src/rpc-contract";

export { rpcContract } from "./src/rpc-contract";

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("guided-review loaded");

  bb.rpc.register(rpcContract, {
    ping() {
      return { ok: true };
    },
  });
}
