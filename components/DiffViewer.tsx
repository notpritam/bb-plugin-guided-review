import { memo, useMemo, useState } from "react";
import { parsePatchFiles } from "@pierre/diffs";
import type { AnnotationSide, DiffLineAnnotation } from "@pierre/diffs";
import { FileDiff } from "@pierre/diffs/react";
import { splitPatchByFile } from "../src/patch";
import type { DraftComment } from "../src/draft";
import { InlineCommentComposer } from "./InlineCommentComposer";

// GitHub-style inline commenting: hovering a diff line reveals a "+" gutter
// button (renderGutterUtility); clicking it opens an inline composer anchored
// to that line (rendered via a "composer" line annotation); submitting adds a
// draft comment that then renders inline as a "comment" line annotation.
//
// NOTE on @pierre/diffs@1.3.6: `enableGutterUtility: true` must be set
// explicitly in `options` — supplying the top-level `renderGutterUtility`
// React prop does NOT implicitly enable it (confirmed via
// dist/managers/InteractionManager.js's resolveEnableGutterUtilityOption,
// which returns `enableGutterUtility ?? false` regardless of
// renderGutterUtility). Do not also set `options.onGutterUtilityClick` —
// the same function throws at runtime if both it and renderGutterUtility
// (post React-wrapper merge) are non-null.
type CommentAnnotationMeta = { kind: "comment"; comment: DraftComment; index: number };
type ComposerAnnotationMeta = { kind: "composer" };
type AnnotationMeta = CommentAnnotationMeta | ComposerAnnotationMeta;
type ComposingAt = { file: string; line: number; side: "LEFT" | "RIGHT" };

function sideToAnnotationSide(side: "LEFT" | "RIGHT"): AnnotationSide {
  return side === "RIGHT" ? "additions" : "deletions";
}
function annotationSideToSide(side: AnnotationSide): "LEFT" | "RIGHT" {
  return side === "additions" ? "RIGHT" : "LEFT";
}
function makeCommentAnnotation(comment: DraftComment, index: number): DiffLineAnnotation<AnnotationMeta> {
  return {
    side: sideToAnnotationSide(comment.side),
    lineNumber: comment.line,
    metadata: { kind: "comment", comment, index },
  };
}
function makeComposerAnnotation(composingAt: ComposingAt): DiffLineAnnotation<AnnotationMeta> {
  return {
    side: sideToAnnotationSide(composingAt.side),
    lineNumber: composingAt.line,
    metadata: { kind: "composer" },
  };
}

export const DiffViewer = memo(function DiffViewer({
  patch,
  files,
  draft,
  addComment,
  removeComment,
  activeChapterId,
}: {
  patch: string;
  files: string[];
  draft: { comments: DraftComment[] };
  addComment: (comment: DraftComment) => void;
  removeComment: (index: number) => void;
  activeChapterId: string;
}) {
  const [composingAt, setComposingAt] = useState<ComposingAt | null>(null);

  const parsedFiles = useMemo(() => {
    const scoped = splitPatchByFile(patch)
      .filter((f) => files.includes(f.path))
      .map((f) => f.text)
      .join("\n");
    if (!scoped.trim()) return [];
    return parsePatchFiles(scoped).flatMap((p) => p.files);
  }, [patch, files]);

  const darkTheme = document.documentElement.dataset.bbCodeThemeDark;
  const lightTheme = document.documentElement.dataset.bbCodeThemeLight;
  const theme = darkTheme && lightTheme ? { dark: darkTheme, light: lightTheme } : undefined;

  if (parsedFiles.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes in this chapter.</p>;
  }

  return (
    <div className="space-y-4">
      {parsedFiles.map((fileDiff, i) => {
        const filePath = fileDiff.name;
        const commentAnnotations = draft.comments
          .map((comment, index) => ({ comment, index }))
          .filter(({ comment }) => comment.file === filePath)
          .map(({ comment, index }) => makeCommentAnnotation(comment, index));
        const lineAnnotations: DiffLineAnnotation<AnnotationMeta>[] =
          composingAt && composingAt.file === filePath
            ? [...commentAnnotations, makeComposerAnnotation(composingAt)]
            : commentAnnotations;

        return (
          <FileDiff<AnnotationMeta>
            key={fileDiff.name ?? i}
            fileDiff={fileDiff}
            options={{ ...(theme ? { theme } : {}), enableGutterUtility: true }}
            lineAnnotations={lineAnnotations}
            renderAnnotation={(annotation) => {
              const meta = annotation.metadata;
              if (meta.kind === "comment") {
                return (
                  <div className="flex items-start gap-2 rounded border border-border bg-card px-2 py-1.5 text-xs text-foreground">
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">{meta.comment.body}</span>
                    <button
                      type="button"
                      aria-label="Remove comment"
                      className="shrink-0 text-destructive"
                      onClick={() => removeComment(meta.index)}
                    >
                      ✕
                    </button>
                  </div>
                );
              }
              return (
                <InlineCommentComposer
                  onSubmit={(body) => {
                    if (!composingAt) return;
                    addComment({
                      file: composingAt.file,
                      line: composingAt.line,
                      side: composingAt.side,
                      chapterId: activeChapterId,
                      body,
                    });
                    setComposingAt(null);
                  }}
                  onCancel={() => setComposingAt(null)}
                />
              );
            }}
            renderGutterUtility={(getHoveredLine) => (
              <button
                type="button"
                aria-label="Add comment"
                className="flex h-4 w-4 items-center justify-center rounded-sm bg-foreground text-[11px] leading-none text-background hover:bg-foreground/80"
                onClick={() => {
                  const hovered = getHoveredLine();
                  if (!hovered) return;
                  setComposingAt({ file: filePath, line: hovered.lineNumber, side: annotationSideToSide(hovered.side) });
                }}
              >
                +
              </button>
            )}
          />
        );
      })}
    </div>
  );
});
DiffViewer.displayName = "DiffViewer";
