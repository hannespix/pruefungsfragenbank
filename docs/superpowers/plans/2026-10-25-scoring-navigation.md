# Point proposals and linked paper navigation

Standing user instruction permits autonomous design and publication.

- Preserve every existing total and original partial criterion. For missing totals suggest a 100-point working scale, explicitly not an official rule or weighting between exam components.
- Keep source partial points intact and allocate only the remainder as proposed criteria. Mark provenance and require review. Do not invent solutions. Existing used exams remain untouched.
- Store proposals in the private question bank with optimistic per-record versions; update missing totals in editable drafts only. Preserve all other content and verify persisted records.
- Category/tag selection navigates the preview to the first matching inserted task. Clicking an inserted card navigates to its exact snapshot. Unrepresented categories do not add tasks or jump to unrelated content.
- Smooth scrolling stays inside the paper stage, respects reduced motion and highlights the destination. Use element matching rather than selectors interpolated from imported IDs.
- Regression tests for proposal totals/provenance/preservation and navigation; synthetic browser verification; review, PR, merge and verify Pages deployment.

User additionally requests original-style exports and task graphics. Match the inspected original letterhead/name/date layout, distinguish letterhead logos from task figures, and retain the existing linked plan preview plus its original PDF. Do not fabricate missing plans or assign one to unrelated questions.

Verification and data update:
- Private API update completed with optimistic versions and before-image backup: 232 records (229 bank tasks, three editable drafts). 228 new proposals; one original total preserved; no missing task totals remain. Original task text, solutions and known criteria verified unchanged.
- 221 task letterheads identified from four inspected source logos; original PDF added only to its already-linked plan task. No logos/plans embedded into public code.
- Independent review found a missing proposal label in cards/catalog CSV; fixed consistently and covered by regression test.
- Browser checked category navigation, preview-only scrolling, selected page sync and original-style letterhead/name/date layout with synthetic data.
