# Coordinator workflow implementation plan

Goal: make the complete meeting → groups → ZP/AP → review flow discoverable at launch.
Spec: docs/superpowers/specs/2026-10-25-coordinator-workflow-design.md
Architecture: existing static JS application; additive meeting records and exam
references; existing encrypted deployment unchanged. No network/auth simulation.

- [ ] Domain: add optional workshops collection and exam workshopId/examYear. Validate
  references, specialty/year consistency, valid dates; merge remaps references.
  Tests: legacy migration, roundtrip, invalid and orphan metadata, merge collision.
- [ ] UI: dashboard first; meeting preparation and selection; specialty workspaces
  with separate AP/ZP cards; global results; groups/invitation status destination.
  Guard editing a meeting against stranding linked exams. Keep exports coordinator-only
  in the documented prototype; disabled invitation controls explain missing backend.
- [ ] Verify: full node suite, both static builds, browser walkthrough of create
  meeting → specialty → pattern → new exam → overview; small-screen layout.
- [ ] Review, fix material defects, commit, PR, merge and verify Pages deployment.

Review focus: old projects, multiple meetings/years, absent source tasks, linked
exams after meeting edits/import conflicts, no misleading auth or working QR claims.

## Execution and verification

- Domain implemented; six regression tests witnessed failing before implementation,
  then passing. Legacy projects and merge collision propagation covered.
- Dashboard, meeting preparation, group ZP/AP tracks, results and blocked access
  location implemented. Public encrypted seed unchanged.
- Review identified two important UI defects (lost meeting selection after archive
  browsing; global source archive empty). Both reproduced with failing event-driven
  app tests and corrected. Full suite now 43 passing.
- Actual private corpus tested in session-only internal browser preview: meeting,
  GaLaBau group, ZP pattern confirmation for test only, new linked exam, six rotation
  proposals accepted, return to group shows correct draft. Invitation dialog clearly
  blocks QR/link generation. No test changes exported into the published corpus.
- Ruling: keep true invitations unavailable until server-side authentication exists;
  a fake QR or shared-key invitation would expose the entire corpus. This is an
  infrastructure dependency, not a working access-control feature.
- Review exclusions retained: crypto unchanged and covered by existing tests; actual
  authentication cannot be verified because it is not implemented. Visual QA is
  performed by the implementing agent. No minor findings deferred.
