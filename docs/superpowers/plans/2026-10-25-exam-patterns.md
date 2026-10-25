# Category-led practical exam planning

User requested stricter AP/ZP separation, recurring category patterns, category → task family → variant browsing, rotation by family, no offline satellite packages, and eventual temporary examiner access with coordinator-only exports. User has delegated routine choices and automatic PR/merge.

## Scope and implementation
- Preserve encrypted corpus unchanged; derive category proposals from explicit original task headings at runtime. Do not publish private titles or metadata separately.
- AP and ZP plus specialty are mandatory workspace context. Families, source lists, exams and selection follow that context.
- Persist editable patterns per context with required category counts. Historical presence is evidence, not a statutory pattern. Require explicit pattern confirmation; copy pattern into new exams so subsequent edits cannot change past exam requirements.
- Category cards show families and variants. Combined tasks may cover several categories. Keep a source-heading explanation and permit manual category corrections.
- Rotation considers all variants/revisions in a family, confirmed uses plus separately labelled source-year evidence; unknown history ranks for review, never as proven unused. Ignore future plans. Do not propose duplicate families or overfill pattern counts. Warn on unresolved requirements.
- Remove satellite export implementation and routes. Existing exports remain only in the visibly labelled coordinator prototype. No pretend role switch or client-side expiry advertised as authorization.
- Document serverless API and private GitHub data repository boundary: server-side sessions, expiring committee scopes, per-request authorization, server storage and coordinator-only output. Live role enforcement needs an API deployment and credentials; GitHub Pages remains a coordinator test only. Do not distribute this shared password as an examiner login.

## Tasks
1. Tests first: classification from headings, AP/ZP and specialty separation, combined coverage, immutable patterns, family rotation/revisions, unknown history, missing slots, no duplicate family suggestions.
2. Implement planning.js, integrate portable schema optional pattern profiles, UI workspace, categories, pattern editor, coverage and proposal actions. Remove satellite code.
3. Test against full local corpus, build compatibility, independent review, PR/merge/Pages deployment verification.
4. Provide clear security handover and remaining hosting prerequisite. Existing downloaded copies cannot be revoked and screen capture cannot be prevented by a browser app.

Ruling: user requires keeping GitHub Pages. Proposed architecture is Pages + private data repo + serverless access API, with authoritative session storage for immediate revocation; do not claim two repositories alone implement auth. No service account/API deployment has been supplied yet.

## Verification evidence
- 35 tests pass after independent review fixes: imported pattern version validated/escaped; exact coverage rejects outside categories; confirmed dates sorted with day precision; constrained proposal search handles combinations; pattern import conflicts rejected explicitly.
- Browser QA on private local corpus: ZP GaLaBau context, six observed category proposals, test-only pattern confirmation, new draft, six rotation proposals, coverage 1/1 in each category, solution preview still clearly marked as draft where original solutions/points are missing. No test edits were published or persisted.
- Encrypted seed and password unchanged; only public application code and documentation updated.
