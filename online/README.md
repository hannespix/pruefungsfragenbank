# HortiExam online

GitHub Pages hosts public application code only. Cloudflare Worker `hortiexam-access`
controls every private read/write. D1 `hortiexam-production` stores the original
project, attachments, exam drafts, temporary invitations and sessions. The database
has EU jurisdiction and read replication disabled. No runtime GitHub token is used.
The private `hannespix/fragenbank` repository is reserved for a possible future
backup integration; it is not the active store.

## Use

1. Open the existing Pages URL and sign in with the coordinator password.
2. Create a preparation meeting, exam year and specialties.
3. Under **Gruppen & Einladungen**, activate a session for up to 24 hours.
4. Show each specialty's QR code or copy its link. Members provide a device label.
5. Compare the device code and approve each pending request.
6. Groups prepare ZP and AP separately. Changes save centrally. The coordinator
   uses **Aktualisieren** to retrieve colleagues' latest saved drafts.
7. Close the meeting to revoke all group sessions and invitation links. Reopening
   generates new invitations and requires fresh device approval.
8. Coordinator reviews and approves tasks/solutions and exports both exam versions.

One device should edit a given exam at a time. Per-record versions reject stale
writes rather than silently overwrite another editor. A conflict leaves local
changes unsaved; use the UI's conflict recovery to keep a separate draft or reload.
Groups can edit snapshots inside drafts, but cannot approve their own edits,
change bank records/patterns, download originals or invoke coordinator exports.

The **Fragenbank** offers combined filters, cards/table views and selected-task
CSV, JSON or printable ZIP exports for coordinators. These filtered exports are
not full-project backups. The **Prüfungsblatt** editor uses the same A4 template
as preview/export; edits affect exam snapshots and reset review approval.
**Hilfe & Sicherheit** explains storage, processing, access and limits in German
and is available before sign-in.

## Security boundaries

- Bearer tokens are 256-bit random values. The browser keeps only the token and
  pending device code in tab-scoped sessionStorage, so reloads preserve sign-in.
  Every restore revalidates approval and expiry on the server; it never extends
  access. Logout/revocation/expiry clear the saved token. Browser tab restoration
  may restore sessionStorage, so explicitly log out on shared devices. Only token
  hashes persist in D1; passwords and exam data are never saved in browser storage.
- Invitations travel in URL fragments, immediately removed from the address bar.
  Invitations alone never authorize reading data: every device requires approval.
- The existing high-entropy coordinator password is checked using a PBKDF2-SHA256
  verifier stored as Worker secret `ADMIN_VERIFIER`, with login rate limiting.
- Exact CORS origin, `no-store`, bounded requests and server-side role/scope checks.
  D1 transactional guards recheck approval, expiry and meeting generation on save.
- Group UI clears on revocation polling (15 seconds) or local expiry; each new
  request is checked immediately on the server. A network outage cannot retract
  data already displayed, and no website can prevent screenshots or manual copies.
- Old encrypted Pages archives remain in Git history; the new Pages artifact does
  not contain them. Previously downloaded copies cannot be remotely revoked.
- No private data, passwords, session credentials, or generated private builds
  belong in this repository. D1 is the live store; coordinator JSON exports provide
  a portable manual backup. Automatic private-repository backups are not enabled.

## Development and deployment

```sh
npm ci --prefix online --ignore-scripts
npm test --prefix online
npm run build --prefix online
node --test offline/tests/*.test.cjs
python online/tools/build_pages.py --out pages-dist
```

`schema.sql` is idempotent bootstrap schema. Attachments exceeding 512,000 base64
characters use `asset_chunks`, keeping individual rows below D1's size limit.
Changes to an existing schema require explicit migration design, not recreating DB.
The Cloudflare connector deployed the Worker and secret. With an authorized local
CLI session, `wrangler deploy --config online/wrangler.jsonc` deploys equivalent
configuration; set `ADMIN_VERIFIER` securely without exposing it to command logs.
Pages deploys through `.github/workflows/pages.yml`; it does not deploy the Worker.
Deploy compatible backend changes before merging frontend changes.

Tests exercise real SQLite transactions and API requests, including revocation,
expiry, scope, source stripping, conflicts, invalid approvals and large assets.
Browser UI fixtures contain synthetic demo data only and are not published.
