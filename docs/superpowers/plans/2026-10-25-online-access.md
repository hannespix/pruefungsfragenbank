# Online group access implementation

User authorized complete Cloudflare setup, GitHub Pages frontend, automatic PR/merge.
Cloudflare account and private hannespix/fragenbank verified. R2 is not enabled.

Architecture decision: use one separate EU D1 database for transactional records,
assets, sessions and approvals. This removes the runtime GitHub-token prerequisite
and gives central durable saving now. GitHub Pages remains hosting; private GitHub
JSON backup is a later optional integration, not the active database. No credentials
will be extracted from connector authorization. No unrelated Cloudflare resources
changed. Existing encrypted public archive is retired from the deployed Pages build.

- [x] Backend: bounded JSON requests, exact CORS, no-store, high-entropy session
  credentials only in browser memory, hashed invites/sessions, rate-limited admin
  authentication, pending device approval, close/reopen revocation and expiry.
- [x] D1 records: private assets, validated project records, per-entity revisions,
  atomic optimistic writes, group restriction to own meeting/specialty exams,
  server-side denial of exports, archive imports and pattern confirmation.
- [x] Frontend: public code without embedded corpus; admin login and group invitation
  fragment exchange; same editor with role-appropriate actions; central saves,
  explicit save/conflict status; QR display, approvals, closing and reopening.
- [x] Seed exact original corpus including assets into private D1; configure admin
  verifier as Worker secret using existing high-entropy password; never print it.
- [x] Verify real request handlers with SQLite transactions, invalid/expired tokens,
  other-group reads/writes, revoked sessions, concurrency and payload limits.
  Build/type-check, review, deploy Worker, verify unauthenticated denial, then switch
  GitHub Pages via PR and merge. Preserve encrypted legacy repository history.

Scope: no screenshot/copy prevention guarantee; no offline satellites; no new
accounts/passwords for group members. One preparation meeting controls invitation
expiry. Each device needs approval and receives only its group's corpus and drafts.

Implementation evidence (2026-10-25): 43 existing offline tests and 14 online tests
pass. Original corpus seeded: 229 tasks, 256 sources, 252 attachments, 129 families.
Exact sampled attachment bytes verified. Live Worker API exercised pending denial,
approval/scope, group draft persistence, export denial, close/read-write revocation
and old-link rejection. Disposable test records removed. Worker deployed; Pages
PR/merge and final deployment verification follow.

Review fixes: compare sanitized approved snapshots, preserve coordinator attachment
copies, block interaction and serialize saves while refreshing or recovering a
conflict, restore baselines on failed copy recovery. Original transfer temporarily
blocked by automatic approval review; authenticated account/destination ownership
was verified and the same authorized transfer subsequently approved.
