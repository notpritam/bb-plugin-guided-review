---
name: Guided Review — BB-native Operate surface
description: Existing BB theme and controls applied to the review list and chapter workspace.
colors:
  background: "var(--background)"
  foreground: "var(--foreground)"
  card: "var(--card)"
  muted: "var(--muted)"
  muted-foreground: "var(--muted-foreground)"
  border: "var(--border)"
  input: "var(--input)"
  ring: "var(--ring)"
  destructive: "var(--destructive)"
  state-hover: "var(--state-hover)"
  state-active: "var(--state-active)"
rounded:
  control: "calc(var(--radius) - 2px)"
  review-card: "calc(var(--radius) + 4px)"
  start-panel: "var(--radius-2xl)"
components:
  primary-button:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.control}"
  review-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.review-card}"
---

# Guided Review interface

## Overview

This records the incumbent **Operate** surface inside BB. [app.tsx](app.tsx) registers the sidebar panel; [ReviewList](components/ReviewList.tsx) and [ReviewWorkspace](components/ReviewWorkspace.tsx) provide its two working views. The design inherits BB’s typography, semantic colors, controls, and code themes. It establishes no separate marketing identity.

## Colors

The frontmatter retains live host token references so light and dark themes remain authoritative. Background and card surfaces, muted supporting text, borders, focus rings, hover/active fills, and destructive feedback all use those roles. Small PR/local-type marks and status badges add localized violet, sky, amber, emerald, and destructive treatments with explicit dark variants. Status text and icons accompany color.

[DiffViewer](components/DiffViewer.tsx) uses BB’s light/dark code-theme names when supplied and receives the current mode from the SDK. Preserve that connection rather than hardcoding a syntax palette.

## Typography

Interface text inherits the BB sans family; file paths, line references, and CLI examples use monospace. The list title uses the host extra-large scale, increasing one step on larger screens. Review titles and controls predominantly use the small scale, with extra-small metadata and compact 10–11px badges. Headings rely on medium/semibold weight and modest size changes. Keep explanations readable and reserve truncation for titles and paths with constrained space.

## Layout

The list fills the available panel width with 16px padding, increasing to 24px at the small breakpoint. Account context precedes the PR form and first-run disclosure. Review cards grow from one to two to three columns. The input and primary action stack on narrow screens.

The workspace fills the panel’s height and width. Desktop chapters occupy a resizable sidebar, initially 288px and constrained to 200–560px, beside the flexible diff/thread pane. The separator supports pointer dragging and keyboard adjustment. Focus mode reduces header detail; fullscreen expands the workspace.

At widths of 767px or less, chapters become a collapsible full-width section capped at 40vh, controls wrap, and diffs switch from split to unified. Long code scrolls within its file container. The draft tray remains independently scrollable with a 48vh maximum height.

## Elevation & Depth

Thin host borders separate the header, chapters, toolbar, diff files, and draft tray. Review cards add a small hover lift and shadow; the floating review-agent window uses stronger elevation. Button fills respond immediately on hover and transition out over 150ms through the shared motion helper. Loading icons and the agent dock include reduced-motion handling.

## Shapes

Controls and diff frames use the host medium radius; review cards use the larger card radius; the start panel uses the host extra-large radius. Pills identify review state. Icons remain compact and secondary to the task labels.

## Components

- **Account and onboarding:** show the server’s active GitHub account, a check-again action, and authentication guidance. The native first-run disclosure explains setup and the distinction between drafts and GitHub writes.
- **Review workspace:** chapters expose file summaries and risk labels; the toolbar switches Diff/Threads and controls viewed state, focus, and fullscreen. Viewed files collapse, while changed-file indicators preserve re-review context.
- **Draft and agent:** draft comments and notes use labeled disclosures and visible save feedback. GitHub submission is explicit; local reviews show installation-local notes. The movable review-agent window accepts file or selected-line context and offers a route to its BB thread.
- **Recovery:** loading skeletons reflect the workspace structure. Load and generation failures offer retry/back actions; draft-load failure pauses editing. Errors stay visible near the relevant action or in an alert/toast, and submission failures preserve the draft.

## Do's and Don'ts

- Do reuse host tokens, shared controls, visible focus, and explicit loading/error states.
- Do retain full-width panel use, responsive chapter access, and unified narrow-screen diffs.
- Do make server account scope and GitHub write actions clear where users act.
- Don’t imply separate team accounts, remote-machine checkout support, or shared review storage beyond the actual BB installation.
