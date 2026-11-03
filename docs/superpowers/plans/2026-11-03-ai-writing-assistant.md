# Optional AI writing assistance implementation plan

**Goal:** Offer explicitly requested, reviewable language suggestions in task editing and on the virtual examination sheet using current Claude Sonnet.

**Architecture:** Authenticated Cloudflare Worker proxies a bounded text request to Anthropic. The public client contains no API key. Suggestions remain transient until the user explicitly accepts them. Existing save and review mechanisms apply afterwards.

**Design:** Three modes: grammar, clear language, examination wording. Send only the selected text and its field type, not projects, files or personal rosters. Show original and editable suggestion, explain external processing, allow cancel and undo. Never generate solutions from question text or silently change examination facts. Accessibility means clearer wording, not certified Easy Language. Original archive documents are unaffected.

**Approach:** Direct browser calls would expose credentials; GitHub Actions is unsuitable for interactive editing. Reuse the existing authenticated Worker. Configure its secret with an explicit main-branch-only GitHub workflow, using ANTHROPIC_API_KEY and a Cloudflare API token. No secret in Pages artifacts or logs.

**API contract:** GET /api/ai/status -> {enabled,model}; POST /api/ai/suggest {text,mode,field} -> {text,notes,model}. Modes grammar/clear/exam; fields title/task/solution/criterion/instruction. Limit input to 6000 characters. All approved roles permitted; pending, revoked and expired sessions denied. Validate response, cap requests/tokens, timeout and recheck authorization after upstream processing. Model default claude-sonnet-5-5, verified in Anthropic docs on 2026-11-03.

## Work

- [x] Backend: online/ai.js, online/worker.js and API tests. Test missing key, authentication, provider failures/refusal/truncation, payload limits, rate limits, and revocation during a request. No content logging or provider error leakage.
- [x] Client: offline/src/ai.js, app.js integration, CSS, help and build wiring. Independent suggestion dialog preserves existing task form; inline paper edits use existing edit/save workflow. No sending on input/open; explicit button only. Test stale target, cancel, accept, undo, escaped output, review reset, offline/key-missing explanation.
- [x] Setup: main-only workflow and bounded secret upload script; exact GitHub/Cloudflare steps, runtime disable instructions. Secret-only update preserves existing Worker bindings. Test mocked upload and failure redaction.
- [ ] Integration: run relevant suites/builds, inspect synthetic UI, review authorization/data handling, create PR/merge/deploy. No live Anthropic call possible until the user supplies their key.

## Review focus

- A closed/replaced editor must never receive a delayed suggestion or stale overwrite.
- Accepting a suggestion never preserves a prior content approval or modifies source provenance.
- Group access revoked mid-request must not return generated text.
- Provider prompts/errors must not reveal credentials or unrelated examination content.
- Missing secret/connection errors must leave manual editing fully available.
