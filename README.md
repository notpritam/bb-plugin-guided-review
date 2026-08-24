# Guided Review

A [bb](https://getbb.app) plugin that turns a GitHub pull request (or a local git ref) into an
**agent-authored, chaptered walkthrough** — then lets you review it inside bb and submit the
review back to GitHub.

Instead of a flat list of files, a PR arrives as an ordered *story*: the implementation heart
first, its consequences next, and the glue/config last. A bb agent reads the diff and writes the
guide; you read the chapters, browse syntax-highlighted diffs, ask the agent questions inline,
leave comments, and submit — all without leaving bb.

Inspired by [plannotator/guides](https://github.com/plannotator/guides) (the "guided review"
concept and its `guide.json` shape), but native to bb: the generation engine is a bb agent, the
viewer is a bb panel, and it writes back to GitHub — no external CLI and no third-party upload.

## Prerequisites

- **`gh` (GitHub CLI)** installed and authenticated with `repo` scope (`gh auth login`). All
  GitHub access is via `gh`, run locally — the plugin never handles a token.
- **bb** ≥ 0.39.

## Install

```sh
npm install
bb plugin install .
```

After editing sources: `bb plugin reload guided-review` (or run `bb plugin dev` to auto-rebuild).

## Usage

From a project thread's terminal:

```sh
bb review <pr-url | pr-number | git-ref> [--base <ref>]
```

Examples:

```sh
bb review 1234                          # a PR number in the current repo
bb review https://github.com/acme/web/pull/1234
bb review origin/main...HEAD            # a local range
bb review my-feature --base main        # a branch, compared against main
```

Then open the **Guided Review** panel in the sidebar to watch the guide build and review it.

## What you get (Phase 1)

- **Agent-generated guide** — a bb agent reads the diff and authors chapters
  (`title` + `intent` + ordered sections of `{ overview, files }`), with a hard **coverage gate**
  (every changed file lands in exactly one chapter or `unplacedFiles` — never twice, never
  omitted).
- **The panel** — chapter navigator on the left, `@pierre/diffs` syntax-highlighted diffs on the
  right (rendered exactly like bb's own diff panel), a PR header, and a draft-review tray.
- **Review actions** — per-line and per-chapter draft comments, a verdict
  (Approve / Request changes / Comment), and **one batched submit** back to the real GitHub PR
  (`gh api .../pulls/{n}/reviews`).
- **Inline agent-assist** — ask the agent to explain a chapter, assess risk, or draft a comment
  while you review.
- **Context** — reads the PR title/body, existing review comments, and CI checks.

Works on a GitHub PR (via `gh`) or any local git ref (branch / commit / range). Local-ref reviews
skip the GitHub-only bits.

## How it works

- **`bb review` command** (`bb.cli`) — resolves the target, builds the patch (`gh pr diff` /
  `git diff`), stores it, and kicks generation.
- **Generation** — a hidden bb agent runs the bundled `guided-review-generate` skill, reading the
  diff and submitting the guide through two native tools (`read_review_patch`,
  `generate_review_guide`) that are exposed *only* to this plugin's own spawned thread
  (`bb.agents.configure` gated on the origin plugin id).
- **Store** — a per-plugin SQLite database holds the review, patch, guide, and draft.
- **Panel ↔ backend** — a typed `bb.rpc` data plane; a `review:<target>` realtime signal tells
  the panel to refetch when generation finishes.

## Development

```sh
npm test            # vitest (unit + a frontend renderSlot test)
npx tsc --noEmit    # typecheck
bb plugin build     # compile dist/ (server + app bundles)
bb plugin dev       # watch + reload on save
```

Design and implementation notes live in
[`docs/superpowers/specs/`](docs/superpowers/specs/) and
[`docs/superpowers/plans/`](docs/superpowers/plans/).

## Roadmap (Phase 2)

- Reply to and resolve existing PR review threads.
- CI status panel + chapter risk flags populated by the generation agent.
- Re-review on new commits (diff since last review; highlight what changed).
- Local-ref mode with a shareable single-file HTML export.
