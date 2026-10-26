# Historical archive implementation plan

Spec: ../specs/2026-10-26-exam-archive-design.md

1. Audit source metadata and existing rendered PDFs. Prepare version-guarded protected print-copy assets; preserve all existing snapshots and source information.
2. RED→GREEN tests for year/type/specialty grouping, unknown years, practical-only defaults, exact original selection, safe collision-free paths, PDF hash matching, page-size/duplex preservation, missing-file errors. Implement archive domain/export module.
3. Add coordinator navigation, filters, concise collection cards, expandable file details and per-collection/all-filtered exports. Integrate dependencies/builds/help and ensure group denial.
4. Test real 2023–2025 archive downloads and render representative merged PDFs. Full suites/builds, independent review, fix substantive findings, PR/CI/merge/deployment verification.

Review focus: stale print copies, lost source pages or drawings, unknown/inferred dates represented as facts, current bank text replacing historical originals, original/examiner data disclosure to groups, missing assets, unusual filenames and archive-path collisions.
