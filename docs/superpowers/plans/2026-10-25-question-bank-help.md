# Questions, help and reload sessions Implementation Plan

**Goal:** Make the task archive directly searchable/exportable, explain the real deployment in plain German, and preserve valid sign-ins across tab reloads.
**Architecture:** Add independent catalog and help modules to the existing vanilla application. Continue using the authenticated Worker and private D1 store; no schema migration or examination-data publication.
**Tech Stack:** Existing JavaScript, JSZip, Python build, Node tests, Cloudflare Worker/D1, GitHub Pages.
**Spec:** User requests in this conversation; autonomous implementation and PR/merge remain authorized.

## Constraints and review focus
- Groups stay confined to their assigned scope and have no export actions. Catalog exports must be checked against the server and current selection, not pagination.
- Unknown use is not never-used; document years and confirmed family uses remain distinct. Category facets respect specialty/AP/ZP.
- Session storage holds only an opaque token and pending display code, never a password or question data. Every reload revalidates on server; expiry/revocation/logout clear the token. No extension of access time.
- Document the verified EU D1 jurisdiction without claiming worldwide request processing is EU-only. Describe actual logs, access rights, backup limits and screenshot limits.
- Escape HTML and spreadsheet formulas, retain graphics/criteria, and describe export contents before download. No source-document leakage in filtered packages.

## Tasks
1. Add `offline/src/catalog.js` for composable filters, deterministic sorts, facets and CSV/JSON/HTML exports. Add behavioral tests for combined scope, unknown history, numeric nulls, selection, malicious text and attachment boundaries.
2. Update `offline/src/app.js` / style with a direct Fragenbank route, responsive filter panel, cards/table, selection and export dialog. Reuse in scoped exam editor. Add UI tests for admin/group navigation and permissions. Keep existing workflows.
3. Add `offline/src/help.js`, public login help and authenticated role-aware help. Explain workflows, definitions, storage path, processing, logging, temporary access, downloads and recovery. Update build inclusion and deployment documentation.
4. Refactor online start to restore tab-scoped sessions through `/api/session`, including pending approvals. Test reload without credentials, revocation, failure, blocked storage and logout.
5. Run regression tests/builds, inspect synthetic UI/export visually, obtain independent review, publish PR/merge, verify deployed bytes and login help. Keep private corpus outside git.

## Progress
- Base: eb7806bfb08c912a8a79095220eb19cdef52f26b. Existing isolated worktree, new feature branch.
- Verified D1 `hortiexam-production`: jurisdiction eu, read replication disabled (2026-10-25).

- Added user steering: a WYSIWYG A4 editor. Implemented `paper.js` with exam-snapshot edits, linked images, solution/rubric view, direct drag targets and validation. Used exams stay read-only; edits reset approvals.
- Independent review found layout divergence and hidden cross-scope filters. Fixed by sharing the A4 renderer between editing/print and keeping filter state per scope; regression tests cover both.
- Final verification: 57 offline and 25 online tests pass; public build succeeds with no embedded dataset; diff whitespace check passes. Browser QA verified inline snapshot editing, solution view, matching print preview, category filters, selected catalog ZIP generation and public help. Native drag automation did not initiate a browser drag; the actual drop-handler path is covered by an integration test.
- Documentation now describes tab-scoped session restoration, explicit logout and the 24-hour group option. No Worker or database migration is needed.
