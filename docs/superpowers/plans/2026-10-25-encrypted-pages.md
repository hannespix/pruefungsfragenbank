# Encrypted Pages test implementation plan

> Execute inline using superpowers:executing-plans; user approved encrypted real-data Pages test and automatic PR/merge.

Goal: Publish the existing practical exam workshop with its real corpus encrypted at rest, unlock in the browser with a generated high-entropy password delivered privately.
Architecture: AES-256-GCM over gzip JSON, PBKDF2-SHA256 (600000 iterations), random 16-byte salt and 12-byte nonce. Public source and cipher chunks only. HTTPS wrapper decrypts through Web Crypto and renders a session-only app in an opaque-origin sandbox iframe; no plaintext IndexedDB. JSON/ZIP exports are explicitly confidential plaintext. No server sync, remote revocation or screenshot protection.

Alternatives: public PIN gate rejected because it exposes plaintext; webgo backend remains production migration path. User chose encrypted static test.

## Task 1: encrypted package and browser unlock
- [ ] Write failing integration tests: build/encrypt/decrypt fidelity, wrong password and modified ciphertext fail, public build excludes sentinel plaintext and secret; memory mode never opens IndexedDB.
- [ ] Implement offline/pages/crypto.js, offline/tools/seal.cjs, offline/tools/build_pages.py, offline/pages/index.html and launcher.js; add session storage mode to app.js.
- [ ] Verify Node tests and browser unlock, AP/ZP and export behavior; relock/reload clears session.

## Task 2: deployment and private delivery
- [ ] Seal the actual existing corpus locally. Publish ciphertext, manifest, source and workflow only.
- [ ] Add Pages workflow with explicit allowlisted output directory, tests before deployment; PR then merge.
- [ ] Fresh review for confidentiality, crypto, persistence and data-loss behavior; resolve important findings.
- [ ] Verify public deployment and deliver URL plus password privately. Document unpublish and export limitations.

Review focus: incorrect password/corruption; empty/malformed manifest; browser without WebCrypto; accidental plaintext storage; losing unsaved edits on lock/reload. No new dependencies in browser. Retain original offline mode unchanged.

## Execution evidence
- Baseline 22 tests passed. Encryption tests first failed for missing implementation; memory-mode test first failed with one IndexedDB access, then passed with zero.
- Real corpus decrypted and deep-compared locally: 256 sources, 229 tasks, 252 assets, identical to original.
- Independent review: no critical/important findings. Aligned 256-chunk limit; explicitly documented session-only standalone group exports.
- Ruling: user delegated implementation/PR/merge and expressly approved encrypted real-data publication; no additional confirmation gate.
