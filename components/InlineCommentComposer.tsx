import { memo, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

// Small inline composer rendered as a line annotation in the diff (DiffViewer),
// anchored to the line the user clicked the gutter "+" on.
export const InlineCommentComposer = memo(function InlineCommentComposer({
  onSubmit,
  onCancel,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");

  return (
    <div className="space-y-2 rounded border border-border bg-card p-2 text-xs">
      <Textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Leave a comment"
        className="min-h-[60px] text-xs"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={!body.trim()} onClick={() => onSubmit(body.trim())}>
          Add
        </Button>
      </div>
    </div>
  );
});
InlineCommentComposer.displayName = "InlineCommentComposer";
