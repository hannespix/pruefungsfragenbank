# Committee history and Fachwerker catalog implementation plan

> **For agentic workers:** Use executing-plans or subagent-driven-development task by task.

**Goal:** Record who prepared exams per group/year and align Fachwerker topics with the supplied main/subtopic list.

**Architecture:** Extend existing workshop JSON with optional committee records; no separate account or database schema. Preserve a revision history for roster changes. Separate FW category catalog from Gärtner AP legislation and from original task texts.

**Tech Stack:** Existing portable JavaScript domain, plain HTML UI, Cloudflare Worker/D1, GitHub Pages.

**Design:** User delegated implementation choices and authorized PR/merge/deployment. Keep existing architecture. Admin manages named group rosters, group sees own current roster only, admin gets searchable year/specialty/person history with CSV. A roster represents recorded preparation participation, not appointment evidence. Avoid inferring people from device/login labels. Separate workshop records preserve years; roster revisions preserve corrections. No public participant records or private documents.

**Global Constraints:** FW creation remains limited to Gemüsebau and Zierpflanzenbau. Uploaded document contains seven main headings plus subtopics, no task count/time rules. Preserve original wording, provenance, snapshots, and backward compatibility. Harvest maps into plantwork for new FW planning; legacy stored labels remain readable. No source document is committed publicly. No invented FW legal quotas.

**Review Focus:** Existing JSON without committees; failed roster validation must be atomic; groups cannot see other rosters/history or modify them; legacy FW harvest selections still classify correctly; multiple tags cannot turn optional catalog entries into mandatory exam tasks.

### Task 1: Committee persistence and privacy
- [x] Add failing domain/API tests for optional workshop committees, append-only roster revisions, year/person lookup, malformed data and cross-group redaction.
- [x] Implement portable core APIs and scoped Worker output; retain admin-only writes and existing optimistic concurrency.
- [x] Run targeted domain/API tests.

### Task 2: FW main/subtopic catalog
- [x] Add failing tests for all seven exact titles, documented subtopics, harvest compatibility, no automatic mandatory seven-task pattern.
- [x] Implement FW catalog, optional examples and legacy mapping in planning, tests and documentation. No numeric legal rules from this document.
- [x] Run relevant FW/AP regression tests.

### Task 3: UI and help
- [x] Add group roster entry/view, admin year/person/specialty history, roster CSV and explanatory help.
- [x] Show FW main/subtopics in planning/editor and task authoring; explain optional category selection and source limits.
- [x] Test save, history, permissions, catalog selection, mobile layout with synthetic data.

### Task 4: Release
- [ ] Independent review, relevant full tests/builds and readonly production compatibility check.
- [ ] PR, CI, Worker update, merge and Pages deploy. Verify served build and unchanged existing production records.

## User additions during implementation
- Add 48 hours as an access duration; server ceiling and tests must agree. Default remains four hours, early closing unchanged.
- Map profession codes from supplied screenshot: 031–037 and 171–177 in order Zierpflanzenbau, Gemüsebau, Baumschule, Obstbau, Staudengärtnerei, Garten- und Landschaftsbau, Friedhofsgärtnerei; 030/170 general qualification only. Show full names and retained code in qualification metadata. Keep original source wording/filenames and never invent a specialty from a general code.

### Added current-exam instruction
- User states the Berichtsheft allowance ended in 2026. Remove positive allowance statements from new task/exam copies and current source-layout text while preserving archival originals. Current existing drafts show a cleanup action and cannot export while a recognized allowance remains. Tests cover copied text, source-page baseline consistency, negatives, old used exams, and manual entry. Separate scanned attachments still require visual review. This is a user operational rule, not a claim from the GärtnAusbV.
