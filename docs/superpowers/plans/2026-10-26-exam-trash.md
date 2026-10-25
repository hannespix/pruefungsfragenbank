# Recoverable exam deletion

The coordinator can move unused drafts to a recoverable trash area from the editor options and restore them from the results page. Tasks and exam snapshots remain stored. Used exams and usage evidence must remain intact. Group access cannot read, trash, restore or overwrite trashed exams; the API enforces this beyond the UI.

- [x] Domain tests and API regression test observed failing before implementation.
- [x] Add optional deletion timestamp, active-list filtering, recoverable coordinator actions and server authorization checks.
- [x] Explain automatic save confirmation, explicit dialog save and remaining loss windows in plain-language help.
- [x] Verify UI deletion/restoration, tests and independent review (including save-in-flight navigation guard).
- [ ] Merge and deployment.

No existing user examination is deleted as part of implementation. UI verification uses local test copies.
