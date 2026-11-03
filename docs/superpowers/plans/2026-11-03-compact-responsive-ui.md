# Compact responsive workspace implementation plan

Goal: Reduce visual clutter and make the examination workflow useful on small screens.

Design (implementation choices delegated by the user): Keep existing routes and data models. Show three primary destinations: Übersicht, Prüfungen, Aufgaben & Archiv. Put administration in an expandable menu. Present task search and historical examinations as two views of the same collection, preserving their filters and permissions. Reduce dashboard duplication. In the examination editor keep step navigation and a compact status visible; expand required fields, regulations and oral selection on demand. Keep actions available by keyboard/touch and existing exports coordinator-only.

A unified mixed task/document search would obscure the difference between a task and a historical document. Two subviews under one destination preserve this distinction without duplicating navigation. No framework or data migration.

- [x] Unify navigation and collection header; preserve filtering, old internal routes and role restrictions. Update behavioral navigation tests.
- [x] Compact dashboard, task filters and editor toolbars. Retain visible counts and one-click access to required fields, time planning and oral requirements.
- [x] Improve small-screen layout: wrapping controls, narrow gutters, mobile task/sheet switch, contained original-page scrolling, accessible touch targets and viewport-safe menus. Preserve printing.
- [x] Verify focused workflows, full suites/build and available browser checks; independent review; PR, merge and verify Pages publication.

Review focus: hidden active filters; committee/session access discoverability; group export restrictions; collapsed state across editing/rerender; mobile overflow and keyboard focus. Original examination layouts and print/export renderers remain unchanged.

User steering: Point distributions must be proposed/adopted like time plans, coordinators can approve the complete examination in one action, solutions are optional, and source-review messages must explain the concrete outstanding checks. Points proposals preserve known scores and clearly label allocations; contradictions remain actionable. A bulk coordinator approval acknowledges reviewed import notes without erasing provenance and validates the examination before changing it. Existing group permissions remain intact.

Execution update: The new domain/API work is independent from responsive layout. Delegate that bounded module and its regression tests while the primary implementer finishes the UI and visual checks. The primary integrates its documented interface and runs the full suite.


Verification: 354 offline Node tests, 264 online tests, and 3 Python import tests passed. Offline HTML, public no-dataset Pages client and Worker bundle built. Independent review identified group regulation controls and stale manual approval fingerprints; both were corrected, including new-family/revision ordering. Overlay tests cover messages over open dialogs, raising a message when another dialog opens, and viewport-bound floating help. Native popovers provide the top layer in current Chrome/Edge. Local browser visual QA was unavailable because the browser security policy rejected the local file URL; no visual-test claim is made. Public artifact verification follows publication.
