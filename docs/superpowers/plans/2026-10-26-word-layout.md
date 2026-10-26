# Word layout repair plan

Spec: ../specs/2026-10-26-word-layout-design.md

1. Preserve archive WIP; inspect actual existing Word/HTML output. Add failing assertions for named styles, structured identity/metadata/letterhead and modern DrawingML source shapes.
2. Vendor pinned docx 9.6.1 and license. Separate existing validated asset/font helpers from presentation. Implement native Word layouts with docx and integrate all builds. Keep protected full-font embedding where the library lacks regular/bold family support.
3. Render actual multi-task exam candidate and solution plus representative original ZP/AP pages. Compare geometry, content, images, overflow, reverse sides and visual design; run complete suites/builds.
4. Independent review, fix substantive findings, PR/CI/merge and verify live build. Resume archived-year feature from preserved stash.

Review focus: accidental loss of solutions/images; source pages or reverse pages changing; duplicate section/footer artifacts; unsafe layout fallback; full editable font embedding; candidate confidentiality; missing styles/headers in legacy snapshots.
