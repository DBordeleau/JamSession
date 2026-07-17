# Delivery plan and verification

Status: PIVOT-09 complete locally; PIVOT-10 same-project reset authorized and pending

## Implemented foundation

PIVOT-01 through PIVOT-09 delivered the manifest-v3 domain, deterministic semantic diff, bundled preset runtime, normalized Postgres model, Studio and collaboration cutovers, public reads, application/Supabase cleanup, clean migration baseline, deterministic testing, and documentation reconciliation.

The historical PR 01–20, OPT-01–OPT-05, MIDI-01–MIDI-07, and STUDIO-01–STUDIO-06 plans explain how the repository reached the pivot. They are superseded sequencing and must not be used as current environment, migration, or deployment instructions.

## Normal implementation gates

1. Inspect the relevant authority and nearby code.
2. Run the narrowest unit, pgTAP, or browser path while iterating.
3. Run `npm run check`; it includes formatting, lint, strict types, unit tests, production build, and the MIDI-only static contract.
4. For schema work, start local Postgres, run one clean `npm run db:reset`, `npm run db:check`, regenerate types atomically when needed, and stop Supabase.
5. For cross-feature browser behavior, start the reduced Auth stack and run `npm run test:e2e:local` once. The default path covers identity, MIDI Studio save/publish/preview, contribution acceptance, and fork lineage without Storage or Edge Runtime.
6. Run `git diff --check` and review generated artifacts, secrets, and unrelated changes.

The two-attempt ceiling applies to an unchanged environment blocker. A concrete fixture, selector, query, or harness correction permits one validation run of the corrected path.

## Next product slices

1. Semantic visual diffs become the musician-facing review surface.
2. The public MIDI pattern library adds explicit listing, search, preview, reuse, and lineage.
3. Challenges add versioned rules and validation snapshots over exact immutable revisions.

See the tracked [roadmap](../ROADMAP.md) for outcomes and ordering.

## Hosted cutover boundary

PIVOT-10 is the only slice authorized to mutate the hosted Supabase project. It retains the existing project reference and environment bindings while destructively deleting all application/Auth/Storage data and obsolete audio project resources, replaying the four clean migrations with a linked remote reset, recreating only required administrator/invitation/avatar state, and verifying hosted MIDI-only behavior. The operator must inventory non-database resources, empty Storage through the Storage API, verify the exact project reference before every destructive command, and never ask another worker or the user to apply migrations out of sequence.
