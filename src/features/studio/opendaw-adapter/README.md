# OpenDAW adapter boundary

This directory is the only allowed dependency boundary for OpenDAW and browser audio APIs.

The future adapter will be client-only, lazy-loaded, and responsible for translating between pinned OpenDAW formats and Jam Session's versioned manifest. OpenDAW is intentionally not installed or integrated in the bootstrap commit.

Before adding code here, read the [system architecture](../../../../docs/technical-design/01-system-architecture.md) and the architectural decisions covering native snapshots, portable manifests, and licensing in [the ADR index](../../../../docs/technical-design/decisions/README.md).

Delete or replace this placeholder when the first real adapter module is introduced.
