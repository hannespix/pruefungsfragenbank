# HortiExam online

GitHub Pages hosts public application code only. Cloudflare Worker `hortiexam-access`
controls every private read/write. D1 `hortiexam-production` stores the original
project, attachments, exam drafts, temporary invitations and sessions. The database
has EU jurisdiction and read replication disabled. No runtime GitHub token is used.
The private `hannespix/fragenbank` repository is reserved for a possible future
backup integration; it is not the active store.

## Optional AI writing assistance

**KI-Schreibhilfe** offers explicitly requested grammar, clear-language and examination-wording suggestions through the authenticated Worker. Users compare the original with an editable proposal and decide whether to apply it. Accepted task edits reset content approval and follow the normal save workflow. No selected text is sent while typing or merely opening the dialog.

The Worker uses Claude Sonnet 5.5 (`claude-sonnet-5-5`, official model documentation checked 2026-11-03). `ANTHROPIC_API_KEY` is a Worker secret, never a public client variable. Without it, the writing helper explains that setup is missing; manual editing continues normally. Only the selected text, mode and field type go to Anthropic. No project, assets or committee roster is sent automatically. Prompts and suggestions are not stored in the service or its logs. Anthropic's handling follows the provider agreement/account configuration; this is external processing, not storage solely in D1 EU.

Follow [the German setup instructions](../docs/ai-setup.md) to store `ANTHROPIC_API_KEY` and `CLOUDFLARE_API_TOKEN` as GitHub Actions repository secrets and manually run **KI-Schreibhilfe einrichten** on `main`. The workflow changes only the Worker secret, preserving code, D1 binding and administrator credentials. The same workflow can disable the feature. API validity/billing/model access can be checked only after an actual key is provided.

## Use

1. Open the existing Pages URL and sign in with the coordinator password.
2. Create a preparation meeting, exam year and specialties.
3. Under **Gruppen & Einladungen**, activate a session for up to 48 hours.
4. Show each specialty's QR code or copy its link. Members provide a device label.
   During an active release, **QR-Code & Zugang** retrieves the same saved code
   after reload or a fresh coordinator sign-in, without reopening the session.
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
not full-project backups. The focused **Prüfungsblatt** workspace opens a new scoped draft in one click.
Categories/tasks stay on the left and the editable sheet on the right. Context
help, tags, related alternatives and advanced options use expandable controls.
The editor uses the same A4 template
as preview/export; edits affect exam snapshots and reset review approval.
**Hilfe & Sicherheit** explains storage, processing, access and limits in German
and is available before sign-in.

Attachments load on demand after the workspace opens. Visible image placeholders
load asynchronously with at most four requests and shared in-flight requests.
Bytes stay in tab memory and are reused across metadata refreshes; reload clears
them. Preview/export/backup explicitly await the required bytes and fail on missing
payloads. Logout discards caches and rejects late results.

## Security boundaries

- Bearer tokens are 256-bit random values. The browser keeps only the token and
  pending device code in tab-scoped sessionStorage, so reloads preserve sign-in.
  Every restore revalidates approval and expiry on the server; it never extends
  access. Logout/revocation/expiry clear the saved token. Browser tab restoration
  may restore sessionStorage, so explicitly log out on shared devices. Only token
  hashes persist in D1; passwords and exam data are never saved in browser storage.
- Invitations travel in URL fragments, immediately removed from the address bar.
  Invitations alone never authorize reading data: every device requires approval.
- Invitation verification still uses hashed tokens. To redisplay active codes,
  `invitation_codes` additionally stores AES-256-GCM ciphertext protected by the
  independent Worker secret `INVITATION_VAULT_KEY` (32 random bytes, hex encoded).
  Only authenticated coordinators can retrieve active-generation codes. These
  records are excluded from project exports and are removed on close/reopen.
  Older hash-only releases receive one supplemental code per specialty without
  revoking existing links/devices. Never silently rotate the vault key: existing
  ciphertext needs its original key for redisplay.
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
To roll out the Worker from GitHub, start the manual workflow "Worker ausrollen"
(`.github/workflows/worker-deploy.yml`) on `main` and type `ausrollen`. It runs the tests,
builds a dry-run bundle, checks that `ADMIN_VERIFIER` and `INVITATION_VAULT_KEY` exist,
deploys with the repository secret `CLOUDFLARE_API_TOKEN` (needs "Workers Scripts: Edit")
and checks `/health`. A faulty version is rolled back in the Cloudflare dashboard under
Deployments.
Deploy compatible backend changes before merging frontend changes. For persistent
invitation redisplay, provision `INVITATION_VAULT_KEY` and apply the additive
`invitation_codes` CREATE TABLE statement from `schema.sql` before deploying the
Worker. Do not recreate existing tables or reopen active sessions during rollout.

Tests exercise real SQLite transactions and API requests, including revocation,
expiry, scope, source stripping, conflicts, invalid approvals and large assets.
Browser UI fixtures contain synthetic demo data only and are not published.

## Point proposals and original-style printing

Missing totals can receive an explicitly provisional 100-point working scale via
`HortiCore.proposePoints`. Existing totals and known partial scores are preserved;
proposed criteria fill only the remainder. Source solutions are never generated.
The private-bank update uses per-record version checks, keeps a before-image and
leaves used exams unchanged. Editable drafts may receive missing scores without
changing their task text or solutions.

`assetLinks[].role = "letterhead"` identifies a source logo separately from task
figures. Candidate-visible letterheads participate in existing scoped asset
authorization and lazy loading. Only inspected source logos receive this role.
The shared paper renderer includes the letterhead and name/date boxes. Original
PDF plans remain separate attachments alongside their inline preview; image
fitting never guarantees scale. No private assets are bundled in Pages.

Category/tag selection and inserted task buttons navigate the paper stage only.
The target is highlighted; reduced-motion preferences disable smooth animation.
