# Practical examinations: offline prototype

Decisions delegated by the user. Preserve the existing Flask application; add an independent offline application under `offline/`. Public repository contains synthetic fixtures only. Private archives and generated datasets must never enter git.

## Milestones
1. Inventory and extraction: preserve originals, media and evidence; distinguish practical, oral and annex documents. Group identical content conservatively and propose task families. Preserve compound exercises. Filename years are not confirmed use dates.
2. Portable domain: versioned JSON, source/asset/family/task/revision/use/exam entities, immutable exam snapshots, safe non-destructive merge, strict validation. Browser IndexedDB adapter, explicit file backups. No local server required.
3. Working UI: search/filter, history and family comparison, manual task editing with images/points/solutions, exam construction/reordering, candidate and examiner documents, local project import/export, subject-specific work packages and return import.
4. Import: local DOCX extraction and review, manual splitting, embedded media preservation; legacy DOC retained and preconverted for initial corpus. Never claim lossless Word layout conversion. Original always downloadable.
5. Verification and delivery: behavioral domain/import/export tests, actual browser workflow, fresh code review, private ready-to-open package. Public code PR and merge after validation.

## Design constraints
- No CDN, remote fonts, analytics, LLM or background data uploads.
- Separate actual exam occurrence from historical source year.
- Points unknown remain null; no invented official answers. Examiner version generated from the exact selected snapshots and includes solution readiness.
- Offline expiry/screenshot prevention cannot be enforced. Workshop packs are confidential copies; hosting later requires server-side authorization and expiring sessions.
- Schema and pure domain functions independent of persistence. Later PHP/MySQL service implements an adapter; future multi-user conflicts must be checked using revisions, no browser direct SQL credentials.
- New document batch can be merged idempotently. Conflicting returns fork examinations rather than overwrite local edits.

## Validation
Node built-in test runner: snapshots, revision immutability, merges, malformed imports, unknown future schema, assessment completeness, provenance, candidate/export separation, date validation. Browser: load >200 tasks, filters, edit, build/reorder, graphics, print preview, backup/import and subject packs. No existing project test suite found; legacy application is unchanged.

## Progress
- [x] Initial document inventory and sample visual review.
- [x] Domain and automated tests.
- [x] UI and import/export.
- [x] Private corpus bundle.
- [x] Browser verification and independent review.
- [ ] PR, merge and delivery.

## Verification outcome

22 Node tests pass. Independent review blockers (malformed imports, unsafe type interpolation, colliding PDF names) were reproduced, fixed, and covered by regression tests; re-review reported no remaining important issues. Browser QA verified task selection, exam-only edits, solution preview, private corpus load, filters, and DOCX splitting with points, solutions and an embedded image. Browser JSON backup downloaded successfully. ZIP creation/unpacking was verified with the bundled JSZip; the cloud browser did not deliver a ZIP download event, so actual ZIP download in that environment remains unverified. Offline file opening on the user's managed PC still needs a user acceptance check.
