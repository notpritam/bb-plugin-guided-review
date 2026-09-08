# Changelog

## 0.1.0 — 2026-09-08

First packaged team preview. Requires BB 0.41.0 and plugin SDK 0.4.34.

- Added first-run guidance, clear account scope, recoverable loading errors, and full-width responsive review layouts.
- Saved notes on blur and before submission, exposed save failures, prevented repeated submission, and preserved edits made while submission is in progress.
- Scoped review identifiers by repository or workspace; retained access to older saved reviews.
- Verified PR snapshots and commit-pinned reviews; rejected comments from stale patches and results from superseded generation workers.
- Added generation cancellation and restart recovery, safe local-ref handling, account-switch verification, and CI failure/pending handling.
- Included installable bundles and documented team repository access, server-local Git/GitHub CLI requirements, and data handling.
