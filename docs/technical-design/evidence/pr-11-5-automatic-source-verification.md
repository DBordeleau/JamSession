# PR 11.5 — Automatic source verification evidence

Date: 2026-07-13

Implemented locally:

- clean migration reset including the private job table, atomic enqueue, lease commands, conditional recovery Cron, and seven-day pruning;
- 33 focused pgTAP assertions covering enqueue, ownership visibility, single claim, stale lease denial, success/quota/credit, bounded transient retry, owner restart, permanent failure, and quota drift;
- shared v2 signature/metadata/hash policy used by the Edge worker and operator fallback;
- region-pinned immediate invocation, no-store bounded polling, safe user copy, and retry without re-upload;
- local Edge runtime accepted a signed recovery request and returned `claimed: false` for an empty queue before the final custom recovery-secret hardening; that request was not repeated after the small auth-header change at the user’s request to stop testing.

Measured hosted CPU, memory, latency, invocation count, Storage reads, and unified egress remain deployment checks because the repository intentionally does not mutate the hosted project. Run one small WAV/FLAC/MP3 and one near-45-MiB fixture after deployment. The Edge-runtime choice is provisional until those bounded hosted checks pass.

Verification completed during implementation:

- `npm run db:reset` — passed;
- focused `00160_automatic_asset_verification.test.sql` — 33/33 passed;
- focused asset unit tests — 10/10 passed;
- `npm run db:types` — generated types updated;
- `npm run typecheck` — passed before the final documentation-only pass;
- local Edge recovery invocation before final recovery-secret hardening — HTTP 202, accepted with no eligible job.

At the user’s request to avoid another costly testing loop, full `npm run check`, browser E2E, and repeated performance fixtures were not run. They must not be represented as passing.
