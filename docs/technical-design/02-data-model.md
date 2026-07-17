# Data model

Status: Current MIDI-only baseline plus forward reconciliation migrations

The clean baseline is intentionally split into four ordered migrations: foundation/identity, MIDI projects/arrangements, collaboration/discovery, and moderation/avatar operations. Forward migrations after that baseline preserve later merged behavior without rewriting already-applied history; the first, `20260717142701`, reconciles administrator-managed beta invitations and is applied to the retained hosted project. Pre-pivot create/alter/drop history remains available through Git history and is never replayed by a clean database.

## Identity and catalogs

- `profiles` stores private lifecycle-bearing identity; `public_profiles` is the safe public projection.
- `reserved_usernames`, `private.signup_invitations`, and `private.app_admins` protect identity and operations.
- `activate_signup_invitation()` lets an active completed administrator activate one normalized address without granting direct table access; the Auth hook remains account-creation authority.
- `licenses`, `genres`, `tags`, and `instruments` are deterministic read-only catalogs.
- Email remains only in Supabase Auth.

## Projects and mutable workspaces

- `projects` owns metadata, owner, visibility/status, contribution availability, current revision, and exact fork source.
- `project_members`, `project_genres`, and `project_tags` normalize authorization and taxonomy.
- `workspaces` stores the mutable canonical manifest-v3 draft and optimistic lock.
- `workspace_tracks` and `workspace_clips` are the queryable MIDI projection. A clip references exactly one immutable `midi_pattern_version_id`.
- `private.workspace_snapshots` stores at most 20 bounded Postgres recovery snapshots per workspace.

Workspace saves are transactional and conflict-safe. No workspace table or projection contains a Storage object reference or a musical-media compatibility union.

## Reusable patterns and arrangements

- `midi_patterns` owns reusable identity, owner, visibility, source pattern, and rights attestation.
- `midi_pattern_versions` stores immutable creator snapshots, exact parent/source version lineage, canonical hash, duration, and CC BY 4.0 reuse terms.
- `midi_pattern_notes` stores canonical normalized notes with stable note IDs.
- `arrangement_versions` stores one immutable complete manifest-v3 snapshot and hash.
- `arrangement_tracks` and `arrangement_clips` normalize the same exact arrangement.
- `project_revisions.arrangement_version_id` and `contribution_versions.arrangement_version_id` bind wrappers to immutable arrangements.

Published history is append-only. Pattern and arrangement projection rows reject updates and deletes. Forks reuse exact pattern-version references copy-on-write.

## Collaboration and discovery

- `contributions`, `contribution_versions`, and `contribution_reviews` model draft, immutable submission, and owner decision.
- `revision_attributions` snapshots publisher and accepted-contributor credit names.
- `activity_events`, `project_stats`, `public_project_catalog`, and `discovery_state` support bounded public reads and ordering.

Acceptance verifies the expected contribution version and current project revision, then creates one project revision in a transaction. Rejected contributions remain visible only to their author and project owner.

## Moderation, deletion, and avatar operations

- Private moderation reports/actions and content holds are operational authority.
- Private deletion requests and retention jobs preserve recovery and legal-hold semantics.
- `assets` contains avatar originals only; ready rows are constrained to sanitized image metadata.
- `profile_avatar_versions` links private originals to immutable public derivative paths.
- Private upload/processing/cleanup jobs and the bounded operator commands own avatar lifecycle.
- Storage contains exactly `profile-images` (private) and `public-avatars` (public derivatives), with one authenticated reservation policy for originals.

There are no musical upload, waveform, quota, processing, network-worker, or scheduled-job tables/functions/extensions in the baseline.

## RLS and grants

All application-facing tables have RLS enabled. Anonymous access is limited to safe catalogs and public projections. Authenticated direct writes are denied; mutations use explicitly granted commands. Suspended or incomplete profiles fail mutation eligibility. Security-definer functions set `search_path=''`, authorize the caller, and have minimum execute grants. Default Supabase table privileges are revoked after baseline creation.

## Seed and generated types

`supabase/seed.sql` deterministically seeds reserved names, MIDI-oriented catalogs, the 24 exact preset rows, discovery state, and the local/CI invitation. Tests create isolated Auth/profile/project/pattern/arrangement fixtures transactionally. `npm run db:types` atomically regenerates `src/lib/supabase/database.types.ts` from the clean local schema; generated output is never hand-edited.

## Planned post-pivot extensions

These are accepted data-boundary requirements, not implemented tables. Their exact schema belongs to the corresponding detailed implementation plan and forward migration.

- **Public MIDI library:** explicit listing records point to exact immutable pattern versions and carry discoverability metadata without making every public-project pattern reusable automatically. A normalized indexed reuse mode distinguishes `commercial_reuse`/CC BY 4.0 from `reference_only`/no reuse grant and supports bounded All/mode Explore filtering. Listing authority includes a versioned rights-basis/attestation snapshot for the selected public display/reuse mode. A commercial listing requires the version's immutable CC BY fields; a reference-only listing requires no reuse license plus a separate public-display attestation. A version that already carries CC BY cannot be downgraded. LIB-01 must expand the current CC-only public-pattern constraint/command/RLS model through a forward migration and expose reference-only notes through a narrow safe projection rather than broad base-table access. Immutable external credits remain separate from verified platform creator/source lineage and may include bounded names, roles, work titles, source URLs, and source terms. Safe projections may expose approved listing, credit, reuse mode, rights term, deterministic musical facet, and public-project usage data only.
- **Saved clips:** private user-owned bookmarks point only to exact immutable commercially reusable pattern versions. Saving never copies notes, changes ownership, or grants public visibility. Studio import creates a normal attributed copy-on-write workspace reference. Save/import/fork/editor-copy/export commands recheck reuse mode authoritatively and reject reference-only versions.
- **Beta feedback:** private bug/suggestion records hold bounded user-provided text and disclosed context for administrator triage. They do not store attachments, complete manifests, secrets, signed URLs, or automatic logs.
- **Challenges:** normalized lifecycle, ownership, featured-placement, entry, vote, and finalized-result relationships accompany a validated versioned constraint snapshot. Entries pin exact immutable project revisions; client preflight never replaces authoritative submission validation. Completed challenge/result rows remain addressable and immutable except for audited corrections or moderation visibility.
- **Achievements:** versioned badge definitions and immutable idempotent awards reference the recipient and authoritative finalized challenge result/revision that earned them. Public profiles use a narrow award projection containing the canonical completed-challenge/result link.
- **Library rights reports:** private report/claimant/source context targets the public listing and exact immutable pattern version. Moderator actions may hide/unhide discovery and preserve review evidence without mutating the pattern notes or published project history.

Every new application-facing table enables RLS in its creation migration and receives explicit least-privilege grants. Public library, completed-challenge, leaderboard, and award projections must not reveal private-project relationships, reports, claimant context, hidden listings/entries, or pre-close votes; feedback, saved clips, challenge administration, and moderation evidence are never broadly selectable. Do not rely on provider defaults to decide Data API exposure.
