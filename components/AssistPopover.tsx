import { memo, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "../src/rpc-contract";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export const AssistPopover = memo(function AssistPopover({
  targetKey,
  chapterId,
  file,
}: {
  targetKey: string;
  chapterId?: string;
  file?: string;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const { answer } = await rpc.call("assist", { targetKey, chapterId, file, question: q });
      setAnswer(answer);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          Ask the agent
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 space-y-2">
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="Explain this chapter / is this safe?" />
        <Button size="sm" disabled={busy || !q} onClick={ask}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
        {answer && <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-foreground">{answer}</p>}
      </PopoverContent>
    </Popover>
  );
});
AssistPopover.displayName = "AssistPopover";
