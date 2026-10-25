# GitHub-hosted UI with temporary committee sessions

Status: proposed next deployment architecture, NOT implemented or enforced by the current Pages prototype. The current coordinator password must not be distributed as a committee access credential.

## Components

- Public code repository and GitHub Pages: UI only.
- Separate private repository: canonical category patterns, task-family data and versioned exam drafts. One JSON file per entity/draft instead of one shared full-bank JSON. Large binary attachments stored separately and served only through authenticated API routes.
- Small serverless API (proposed Cloudflare Worker): authentication, authorization, input validation, constrained GitHub writes and output generation. Store a GitHub App key/installation credential as a server-side secret scoped to that data repository. Never put the token or permanent decryption key in browser code, a QR code or public Actions output.
- Authoritative strongly consistent session/role state (e.g. Durable Objects). No eventually consistent cache for activation/revocation decisions. Repo commits are not a suitable session-revocation store.

## Sessions and QR invitations

Coordinator creates session, allowed specialty + AP/ZP scopes, start/end, and one random invitation per working group. Store only a cryptographic hash of invitation secrets. QR is a short-lived bearer invitation in a URL fragment, removed immediately after exchange. It never contains the permanent corpus key. Optional group password is verified with a password KDF and rate limits; a shared link/password identifies a group, not an individual.

Exchange is allowed only while session is enabled and within time bounds. Issue a short-lived session credential held only in memory (or secure HttpOnly cookies if served under a suitable same-site origin). Validate server-side role, exact session generation/version, time bounds and object scope on every request. Closing a session invalidates existing sessions and invitations, not only new logins. Reopening requires new invitations. No role received from a client is trusted.

Client polls a session-status endpoint; on disable, expiry, loss of authorization, or failed checks it removes the displayed sensitive state. The server immediately denies subsequent requests. Content already received cannot be recalled; copying, screenshots and external cameras remain possible.

## API policy

- Coordinator: administer sessions and patterns, review all assigned work, finalize, export candidate/solution output and archive.
- Examiner: read assigned tasks individually, edit assigned exam draft only; no source-archive endpoint, full-bank dump, group HTML, project export or exam export. Preview only what the workflow requires.
- Every write: schema validation, scope validation, CSRF/origin checks as applicable, payload size limits and concurrency version check.
- GitHub writes: caller supplies last-seen draft version; mismatch returns 409. Serialize repo writes and never silently replace another group's changes. Explicit saves/debounced checkpoints, not one commit per keystroke. Audit the acting session/group separately from Git committer identity.
- Authenticated content: Cache-Control no-store, no service worker/offline copy, no sensitive query parameters or logs. CORS allows only the exact approved frontend origin; CORS is not authorization.

## Required before committee deployment

Provision private repo and service account, API provider deployment and bindings; configure an administrator identity via a secure setup path; verify cross-group denial, export denial for examiners, expiry/revocation during an active session, concurrent save conflicts, and recovery after interruption. Replace the publicly distributed encrypted full-bank flow with per-request authenticated content. Prior downloaded encrypted copies remain decryptable with their old password.

References:
- https://docs.github.com/en/rest/repos/contents
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/platform/storage-options/
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
