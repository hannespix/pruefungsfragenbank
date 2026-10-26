# Word export implementation plan

Spec: ../specs/2026-10-26-word-export-design.md

## Constraints
- No original exam content, fonts or credentials in public git.
- No changes to existing examination snapshots or group permissions.
- Reuse JSZip; native OOXML, not HTML disguised as Word.

## Tasks
1. Write failing tests for native editable content, candidate confidentiality, original front/back pages, asset completeness and stale-template rejection. Implement `offline/src/docx.js` with native paragraphs/tables, anchored source text and embedded images.
2. Add protected embeddable CI fonts, with no public binary assets. Integrate DOCX pair into existing authorized export ZIP and all build paths; explain exported-copy editing in help.
3. Generate and render private ZP/AP samples including two/four-page templates and mixed legacy content. Inspect all sample pages, adjust geometry if needed. Run full suites and builds.
4. Independent branch review, fix substantive findings, PR, CI, merge and verify public deployment.

## Review focus
Confidentiality of candidate files; loss of original reverse sides; malformed/missing assets; editing and line overflow; no group export bypass; no public source data; correctness of section/header relationships and embedded fonts.

## Progress
- Branch starts at 01e1aeba140511637c370e8000cdfd0d6002ef9b.
- Font metadata allows editable embedding (OS/2 fsType 8). Conversion and document QA remain private.

## Verification evidence
- Native package and integration tests: 98 offline tests, 43 online tests pass.
- Protected font migration added only 3 assets; all task and exam snapshots unchanged.
- All 229 source templates export successfully with CI font metrics; no private corpus committed.
- ZP/AP candidate render checks retain 2 / 2 / 4 original pages; no missing source words. Examiner renders have 3 / 3 / 6 pages and editable tables with repeated headings.
- Full embedded fonts deobfuscated and compared byte-for-byte with protected inputs.
- Mixed legacy + odd original + full originals: 10 duplex pages, including explicit blank reverse and automatic odd-page section separation. LibreOffice PDF export must keep automatic blank pages (`IsSkipEmptyPages=false`).
- Microsoft Word Desktop is not installed in this verification environment; cross-version page layout still requires final print preview.
- Independent review found a horizontal-overflow bypass for unbranded fixed pages without font metrics. Fixed by requiring metrics for every fixed source layout; regression failed before the fix and now passes. Final suites: 99 offline / 43 online.
- Browser demo reached the Word ZIP ready dialog. Browser download-event waiting timed out; ZIP contents are independently exercised by the integration test.
