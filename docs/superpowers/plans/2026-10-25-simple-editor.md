# Simple examination workspace

User authorizes autonomous implementation and publication. Build on main including the separate help accordion (#9).

- One creation screen: scoped task library on the left, editable A4 sheet on the right. Remove editor step tabs and global navigation clutter while editing.
- Category buttons explain progress in plain language and filter in place. Search stays visible; tags/sorting, related tasks and advanced settings are collapsed.
- One-click draft creation uses the already chosen meeting, specialty and exam type. Keep data settings accessible afterwards.
- Group similar alternatives, allow deliberate replacement at the same position, and retain scope, read-only and permission checks.
- Provide short first-use instructions, contextual keyboard/touch-accessible information bubbles, a clear empty state, page navigation and an expandable review checklist.
- Keep automatic saving, lazy assets, independent help dialog and shared print renderer. Test creation/filter/replacement/permissions and visually inspect desktop/mobile using synthetic data. Review, PR, merge, verify deployed bytes.

Completed verification:
- 57 offline tests and 37 online tests pass; public client and Worker builds pass.
- Desktop interaction checked: one-click creation, category filtering, adding tasks, tags and contextual help. Mobile layout checked at 390 px.
- Independent review checked scoped replacement and permissions. Escaped imported identifiers in disclosure attributes and added a regression test.
- Public build contains no embedded examination dataset. No backend schema or access-policy changes.
