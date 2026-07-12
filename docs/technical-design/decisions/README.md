# Architecture Decision Records

ADRs preserve decisions that coding agents must not silently revisit. A changed decision requires a superseding ADR, not an unannounced implementation deviation.

## Accepted for initial implementation

### ADR-001: Next.js application with a client-only studio boundary

- **Decision:** Use Next.js App Router for the product and a dynamically loaded client-only studio feature.
- **Why:** Public/social pages benefit from server rendering while Web Audio/OpenDAW requires browser APIs.
- **Consequence:** No OpenDAW import may enter a Server Component or shared server module.

### ADR-002: Supabase as identity, relational authority and object storage

- **Decision:** Use Supabase Auth, Postgres and Storage with RLS on all public-schema tables.
- **Why:** It matches the MVP needs and avoids a bespoke service tier.
- **Consequence:** Service-role access is exceptional; ordinary workflows remain user-scoped and policy-tested.

### ADR-003: Immutable revisions with mutable private workspaces

- **Decision:** Published work and submitted contributions are immutable snapshots; autosave targets private workspace drafts.
- **Why:** Reliable attribution, forks, review and recovery require stable history.
- **Consequence:** Acceptance creates a revision rather than updating one.

### ADR-004: Native OpenDAW snapshot plus portable Jam Session manifest

- **Decision:** Store both artifacts and pin the engine version.
- **Why:** Native fidelity alone creates vendor lock-in and poor server validation; a generic model alone loses editor fidelity.
- **Consequence:** Publish validates correspondence between manifest assets and authorized stored objects.

### ADR-005: Copy-on-write forks and no automatic audio merge

- **Decision:** Forks reference immutable assets; contribution acceptance requires the expected base revision.
- **Why:** Byte duplication wastes storage, and a Git-like automatic merge is unsafe for musical arrangements.
- **Consequence:** An outdated contribution needs manual rebase/resubmission in MVP.

## Deferred during private MVP development; required before external access

### ADR-006: OpenDAW license path

- **Status:** Deferred for private integration; blocking for an external alpha or public network deployment.
- **Options:** Operate the applicable combined work under AGPL-compatible terms, or obtain and comply with a commercial license.
- **Owner:** Product/legal.
- **Evidence needed:** Written interpretation/agreement covering the deployed architecture and modifications.
- **Interim controls:** Preserve notices and attribution, pin versions, record modifications and keep OpenDAW behind the adapter boundary.

## ADR template

```md
# ADR-NNN: Short decision title

Status: Proposed | Accepted | Superseded
Date: YYYY-MM-DD
Owners: names/roles

## Context

What forces the decision?

## Decision

What are we doing?

## Alternatives considered

What credible options were rejected and why?

## Consequences

What becomes easier, harder, required or prohibited?

## Validation

What evidence will confirm the decision remains sound?
```
