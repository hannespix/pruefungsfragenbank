# Complete Word and print package

Goal: One coordinator export contains every created examination component, with materials and internal remarks in separate documents.

Design: Keep the existing participant/solution renderers and attachments. Add a shared organization-report model for material lists, internal remarks and the saved time plan, consumed by HTML and native DOCX renderers. Include five numbered DOCX/HTML pairs and a printable index in the existing ZIP. Preserve practical and oral tasks in the first two documents. No data migration, new service, or examiner export rights.

- [x] Add shared report and DOCX rendering; verify multiline/long notes, proposal/confirmed/missing materials, metadata, escaping, and participant isolation.
- [x] Integrate the complete package into Word & Druck and explain its contents. Verify actual ZIP members, pending-save failure, group restrictions, and the browser build.
- [x] Render synthetic material/remark/time-plan DOCX samples, inspect all pages, run the relevant suites and builds, and review.

Verification: 335 offline JavaScript tests, 251 online tests, and 3 Python tests pass. Word samples flow over multiple pages with native paragraphs. Review regression tests cover metadata-only phase sums exceeding a stated total, keeping unrelated evidence groups separate and ignoring reference-only old phases. Publication uses the verified tree through a PR and a content-only Worker update.

Existing edited text and material status must not change during export. Empty remarks and missing lists receive explicit labels rather than disappearing. Reports contain only the selected examination's materials/remarks and its recorded committee. Participant documents never receive internal remarks or organizational material lists. Long text must flow across pages without textboxes.


User steering: Also offer source-backed editing times and a directly actionable
required-fields overview. A pure timing-plan module proposes complete source
durations first and explicit planning defaults only where safe; known values,
conflicts and original text remain protected. UI displays source/proposal status,
allows adoption, and jumps directly to time, points, solution, review or material
fields. No invented solutions or automatic approvals. Existing statutory guards
remain server-side. Source contradictions require manual reconciliation.
