# PR 17 — Profiles, Dashboard, and Navigation Evidence

## Delivered behavior

PR 17 adds a server-rendered authenticated `/dashboard`, bounded keyset project/contribution indexes, independently paginated public profile histories, a 15-minute operational activity throttle, responsive disclosure navigation, and profile avatars. Avatar originals upload directly to private `profile-images`; the trusted lease-bound Edge worker validates and re-encodes a versioned 512×512 WebP in public `public-avatars`. Replacement/removal atomically changes the safe pointer and queues durable cleanup.

## Security and dependency decisions

- Public profile DTOs expose only `avatar_path` and opaque version ID; email, private originals, hashes, jobs, and activity timestamps remain hidden.
- Application roles cannot read avatar-version/job tables or write/delete public derivatives. Exact live reservations alone may insert private originals.
- Dashboard/list functions verify `auth.uid()`, active/completed profile state, fixed bounds, and use explicit execute grants with empty search paths.
- `@imagemagick/magick-wasm` is pinned at `0.0.41` (Apache-2.0). Supabase documents WASM processing for Edge Functions and notes that native Sharp is unsupported. Hosted paid image transformations are not required.

## Query budgets

- Dashboard: three seven-row list probes and one 100-row capped review probe in one RPC.
- Projects/contributions: fetch 25, render 24, stable `(updated_at,id)` keysets; contribution context is joined once rather than hydrated N+1.
- Public profile: fetch 13/render 12 per independent section, bound to the transactional discovery version.

## Verification

- `npm run db:reset` and `npm run db:check`: passed after compatibility fixes; 21 pgTAP files and 449 assertions passed, database lint reported no findings, and generated types were current.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`: passed; 29 Vitest files/101 tests passed and Next.js built the dynamic dashboard/profile/index routes.
- Focused Chromium dashboard scenario: unavailable after the two-attempt environment cap. The first attempt never reached the app because the partial local stack did not start Auth/Storage. The second authenticated successfully but the generic test actor was incomplete and redirected to onboarding before the dashboard assertion. The fixture now completes onboarding when needed, but was not rerun after the cap.

## Deployment

Deploy migration `20260713222121_profile_dashboard_navigation.sql`, then `process-profile-image`, then the Next.js application. Existing rows remain compatible because avatar pointers are nullable. Application rollback may hide new routes/controls while leaving the additive schema in place; schema corrections remain forward-only.
