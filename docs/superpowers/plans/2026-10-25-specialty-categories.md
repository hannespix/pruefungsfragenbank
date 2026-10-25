# Specialty categories, preparation links and printable invitations

User authorized autonomous implementation, PR, merge and deployment.

- Re-read original source/task headings, separately by specialty and AP/ZP.
  Preserve combined tasks; no invented mandatory counts. Friedhof ZP lacks evidence.
  GaLa AP planning sheet explicitly lists plan transfer, paving, natural stone,
  planting and sowing. Extract those headings rather than discard the sheet.
- Add an archive-backed scope map and one category selector used by pattern editor,
  bank and task forms. Same-scope new tasks can extend observed categories; grave
  care remains exclusive to Friedhof. Show warnings for old incompatible patterns
  rather than silently mutate saved exams. No private question contents in code.
- Fix login brand contrast; add 24-hour duration (server already allows 24h).
  Preserve per-device approval and revocation. Previous-day printed links remain
  valid after coordinator logout; do not imply they require regeneration.
- Add coordinator-only QR invitation printing with specialty, meeting, exam year,
  complete expiry date/time and readable URL. Print only invitation, no exam data.
- Test scope isolation, original structured GaLa headings, 24h server boundary,
  group permissions and print template. Review, deploy updated Worker (shared
  planning logic), then PR/merge Pages and verify published bytes/UI.
