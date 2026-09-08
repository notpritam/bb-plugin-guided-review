# Guided Review

An agent-authored walkthrough of a GitHub pull request or local Git change, inside [BB](https://getbb.app). Read the change in chapters, inspect the diff, ask questions, and prepare your review in one workspace.

**Team preview · v0.1.0.** This repository is private. Each teammate needs repository access and their own BB installation and GitHub authentication. This release does not provide a shared review workspace or separate accounts inside one BB server.

## Install and first run

Requirements: **BB 0.41.0 or newer**, a configured BB coding-agent provider, and `git` and GitHub CLI (`gh`) on the **machine running the BB server**. GitHub features currently support **github.com**. A remote browser does not change where these commands run.

On that server, sign in using your own account with access to this plugin and the repositories you review:

```sh
gh auth login --hostname github.com
gh auth setup-git
bb plugin install git:https://github.com/notpritam/bb-plugin-guided-review.git@v0.1.0
```

The tagged release includes compiled bundles; teammates do not need Node.js, npm, or a build step. If GitHub reports this repository is unavailable, check that the signed-in account has team repository access.

1. Open **Guided Review** in BB’s sidebar.
2. Check the GitHub account shown at the top. Switching accounts affects `gh` on this BB server, including other work that uses it. Environment-token overrides are detected and must be removed before switching saved accounts.
3. Paste a complete GitHub pull-request URL and choose **Start review**. A BB agent reads the patch and writes a chaptered guide.
4. Review chapters and diffs, mark files viewed, and write draft comments or review notes.
5. Choose a verdict and explicitly submit when ready. Drafting and generating a guide do not submit a GitHub review. Replying to or resolving an existing GitHub thread are separate, immediate GitHub actions.

The first-run help is also available inside the panel. Loading, authentication, generation, and save failures provide visible recovery paths.

## Local changes and the command line

Run commands from a project checkout available on the BB server:

```sh
bb review https://github.com/acme/web/pull/42
bb review 42                           # PR in the current repository
bb review origin/main...HEAD           # local range
bb review my-feature --base main       # branch against main
```

The checkout for a local review must exist on the BB server. A checkout only present on another enrolled machine is not supported by this release. Local reviews retain notes in BB and do not offer GitHub submission.

## What the review workspace includes

- Ordered chapters with intent, file summaries, and risk labels. Every changed file must appear once in the generated guide.
- Syntax-highlighted diffs, viewed-file tracking, a resizable chapter sidebar, and a collapsible chapter list on narrow screens.
- A floating BB review agent that can discuss files or selected text.
- CI status, existing GitHub review threads, and re-review when new commits arrive.
- Saved review notes and inline draft comments, with explicit submission and visible save or submission errors.

A review is pinned to the PR snapshot it was generated from. If the PR changes, re-review before submitting. Remove affected inline comments from an older patch, then add any replacements against the current patch. Submission failures retain the draft; repeated clicks cannot submit the same draft concurrently.

## Data and access

Review metadata, patches, generated guides, and drafts are stored in this BB installation’s plugin database. Review agents receive the patch and context through your configured BB provider; that provider’s data handling applies. This plugin does not add a separate hosted review service.

GitHub operations use the server’s `gh` credentials. No token needs to be pasted into the plugin. Grant only the repository access your team needs. A shared BB server uses shared server credentials and plugin storage; it is not a multi-tenant review service.

Older saved reviews remain available. New reviews use repository-scoped identifiers, preventing equal PR numbers in different repositories from overwriting each other. Legacy inline drafts must be removed and re-added against the current patch before submission.

## Development

```sh
npm ci
bb plugin types
npm run check
bb plugin install .
bb plugin dev
```

Development checks use the SDK test harness, temporary Git repositories, and mocked GitHub writes. Use a Node.js version compatible with the installed `better-sqlite3` package (this release was verified on Node.js 24).

Build and commit `dist/` before tagging a release. Keep published tags immutable. Read [CHANGELOG.md](CHANGELOG.md) for release changes.

Inspired by [plannotator/guides](https://github.com/plannotator/guides). The viewer and generation workflow here run through BB.
