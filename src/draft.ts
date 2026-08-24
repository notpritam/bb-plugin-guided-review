export type Verdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface DraftComment {
  file: string;
  line: number;
  side: "LEFT" | "RIGHT";
  chapterId?: string;
  body: string;
}

export interface Draft {
  targetKey: string;
  verdict: Verdict;
  body: string;
  comments: DraftComment[];
}

export function toGithubReviewPayload(draft: Draft): {
  event: Verdict;
  body: string;
  comments: { path: string; line: number; side: string; body: string }[];
} {
  return {
    event: draft.verdict,
    body: draft.body,
    comments: draft.comments.map((c) => ({ path: c.file, line: c.line, side: c.side, body: c.body })),
  };
}
