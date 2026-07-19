# Post-BADGE milestone pulse check

Date: 2026-07-18  
Repository checkpoint: `master` at `97c540d` (`Merge #63 - Challenge reward badges`)  
Outcome: RELEASE-01 is the next implementation slice

## Evidence reviewed

- DIFF-01 through DIFF-03, FEEDBACK-01, LIB-01 through LIB-03, CHALLENGE-01 through CHALLENGE-03, and BADGE-01 are merged on `master`.
- BADGE-01 derives immutable Winner, Community Favorite, and Top Placement awards only from the exact current finalized challenge result. Corrections preserve superseded evidence while the public profile projection reapplies result, challenge, entry, project, and recipient visibility.
- The GitHub repository is already named OpenMIDI, while package metadata, shared application chrome, root metadata, export fallbacks, OAuth setup guidance, persisted engine values, local infrastructure, and tests still contain the former prelaunch identity.
- The user has explicitly waived compatibility with existing prelaunch projects, revisions, patterns, clips, and manifests. Git history is sufficient archaeology; the current tree does not need a permanent legacy namespace.
- The retained hosted Supabase project remains at seven applied migrations. The four LIB, three CHALLENGE, and one BADGE migrations are repository-only and were not applied during this pulse.
- No Vercel project or production origin is currently authoritative. Deployment remains deferred.

## Drift corrected

- The README and PRD checkpoint now mark semantic diff, beta feedback, the full public library, the full challenge program, and badges complete.
- The roadmap, delivery plan, technical index, agent contract, and brand follow-up now identify RELEASE-01 as next and distinguish it from hosted rollout.
- Release sequencing is explicit: RELEASE-01 performs the repository-side OpenMIDI namespace reset and prepares a forward hosted reconciliation migration, RELEASE-02 prepares deterministic beta content and hardening without production mutation, and RELEASE-03 alone owns authorized hosted musical-data deletion, migrations, external configuration, deployment, hosted seed execution, and production smoke.
- A detailed ignored local release plan now defines worker-ready contracts, a zero-former-name tracked-tree gate, validation, and external gates for RELEASE-01 through RELEASE-03.

## Release decisions

- The product, repository, package, runtime, persisted engine, diff, browser, test, and local-infrastructure namespace is **OpenMIDI**. Canonical technical identifiers use `openmidi-*` or `openmidi:*` as appropriate.
- RELEASE-01 removes the former identity from all tracked textual source, including current historical documentation and clean migration source. Git history preserves the original record.
- RELEASE-01 may add a forward identity-reconciliation migration and may reset local musical fixtures. It does not execute that migration or mutate Google Cloud, hosted Supabase, or Vercel.
- The retained hosted project is preserved. RELEASE-03 may delete all existing musical domain data and reconcile database constraints/functions/presets to OpenMIDI rather than migrating prelaunch manifests.
- RELEASE-02 may prepare versioned original/rights-safe seed fixtures and an idempotent operator import path, but hosted content is inserted only during RELEASE-03 after an administrator owner and exact target are confirmed.
- RELEASE-03 requires explicit user authority, an exact production origin, external-account access, and a recorded migration preflight. A code merge never implies deployment authority.

## Readiness

RELEASE-01 is ready to start from `master` at or after `97c540d` using `local/implementation-plans/034-openmidi-release-program.md`. The release slices are sequential. A single RELEASE-01 worker is preferred because package metadata, runtime constants, clean migrations, local infrastructure, fixtures, shared layout, tests, and documentation have broad overlapping ownership.

The eight hosted-pending migrations, in repository order, are:

1. `20260717220750_public_midi_library.sql`
2. `20260717232107_lib_02_library_detail_moderation.sql`
3. `20260718063241_lib_02_bound_history_projection.sql`
4. `20260718070409_lib_03_saved_clips_reuse.sql`
5. `20260718171612_challenge_01_versioned_lifecycle.sql`
6. `20260718190737_challenge_02_exact_entries.sql`
7. `20260718202909_challenge_03_voting_results.sql`
8. `20260718222256_badge_01_challenge_profile_awards.sql`

Do not apply them until RELEASE-03 is explicitly authorized.
