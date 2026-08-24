---
name: guided-review-generate
description: Author a chaptered Guided Review of a diff for the guided-review plugin. The plugin injects the target key.
---

# Authoring a Guided Review

You are producing a **guide**: a chaptered walkthrough of a diff. Follow this exact flow.

1. **Read the diff.** Call `read_review_patch` with the provided `targetKey` (paginate with
   `offset`/`limit` until you have the whole patch). The patch is the authoritative file set.
2. **Chunk and order into sections.** Implementation heart first, its consequences next, and
   glue/wiring/config grouped into a trailing chapter last.
3. **Write** a one-line `title`, a 1–2 sentence `intent` (why the change exists), and for each
   section a concept-level `title`, a 2–6 sentence markdown `overview`, and its `diffs` — each
   `{ file, summary }` where `file` is the exact repo-relative path and `summary` is a 1–2
   sentence semantic description of that file's change. Give each section a short kebab-case `id`.
4. **Verify coverage.** Every changed file must appear in exactly one section's `diffs` OR in
   `unplacedFiles` — never twice, never omitted.
5. **Submit** by calling `generate_review_guide` with `{ targetKey, guide }`. If it returns
   coverage or validation errors, fix the guide and call it again. Never alter the diff to fit
   the guide.
