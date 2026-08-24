import { test, expect } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import type { PluginAgentConfigurationContext } from "@get-bb/plugin-sdk";
import { createStore } from "./store";
import plugin from "../server";

const patch = `diff --git a/a.ts b/a.ts
--- a/a.ts
+++ b/a.ts
@@ -1 +1 @@
-old
+new
`;

async function host() {
  const h = createFakePluginHost({ pluginId: "guided-review" });
  await plugin(h.bb);
  const store = createStore(h.bb); // same pluginId → same DB the factory's tools read
  store.saveReview({ targetKey: "pr-1", kind: "pr", number: 1, status: "generating", createdAt: 1 });
  store.savePatch("pr-1", patch);
  return h;
}

test("read_review_patch returns stored patch text", async () => {
  const { harness } = await host();
  const out = await harness.behavior.callAgentTool("read_review_patch", { targetKey: "pr-1" });
  expect(String(out.content?.[0]?.text ?? out)).toContain("diff --git a/a.ts");
});

test("generate_review_guide rejects incomplete coverage then accepts a full guide", async () => {
  const { harness } = await host();
  const bad = await harness.behavior.callAgentTool("generate_review_guide", {
    targetKey: "pr-1",
    guide: { title: "T", intent: "I", sections: [], unplacedFiles: [], review: { gitRef: "x" } },
  });
  expect(bad.isError).toBe(true);
  const good = await harness.behavior.callAgentTool("generate_review_guide", {
    targetKey: "pr-1",
    guide: { title: "T", intent: "I", sections: [{ id: "s1", title: "S", overview: "o", diffs: [{ file: "a.ts", summary: "x" }] }], unplacedFiles: [], review: { gitRef: "x" } },
  });
  expect(good.isError).toBeFalsy();
});

function baseConfigContext(pluginId: string | null, threadTitle: string | null = null): PluginAgentConfigurationContext {
  return {
    thread: { id: "thread-1", title: threadTitle, parentThreadId: null, sourceThreadId: null },
    project: { id: "project-1", kind: "standard", name: "test-project", gitRemoteUrl: null },
    environment: { id: "env-1", name: null, path: null, workspaceProvisionType: "unmanaged", branchName: null },
    host: { id: "host-1", name: "test-host" },
    provider: { id: "test-provider", model: "test-model", capabilities: { supportsNativeUserQuestion: false } },
    origin: { kind: null, pluginId },
  };
}

test("agents.configure exposes tools/skill only to this plugin's own generation thread", async () => {
  const h = createFakePluginHost({ pluginId: "guided-review", agentSkillIds: ["guided-review-generate"] });
  await plugin(h.bb);

  const mine = await h.harness.behavior.resolveAgentConfiguration(
    baseConfigContext("guided-review", "Generate guide: pr-1"),
  );
  expect(mine.tools.map((t) => t.name)).toEqual(["read_review_patch", "generate_review_guide"]);
  expect(mine.skills).toEqual(["guided-review-generate"]);

  const foreign = await h.harness.behavior.resolveAgentConfiguration(
    baseConfigContext("someone-else", "Generate guide: pr-1"),
  );
  expect(foreign.tools).toEqual([]);
  expect(foreign.skills).toEqual([]);

  const absent = await h.harness.behavior.resolveAgentConfiguration(
    baseConfigContext(null, "Generate guide: pr-1"),
  );
  expect(absent.tools).toEqual([]);
  expect(absent.skills).toEqual([]);

  // Same plugin origin, but this plugin ALSO spawns the assist Q&A thread —
  // it must not receive the generation-only tools/skill.
  const assistThread = await h.harness.behavior.resolveAgentConfiguration(
    baseConfigContext("guided-review", "Assist: pr-1"),
  );
  expect(assistThread.tools).toEqual([]);
  expect(assistThread.skills).toEqual([]);
});
