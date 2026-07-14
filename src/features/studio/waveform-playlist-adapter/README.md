# Waveform Playlist adapter boundary

This directory is the only allowed dependency boundary for Waveform Playlist, Tone.js, and browser audio APIs.

The adapter is client-only and lazy-loaded. It translates between pinned editor packages and Jam Session's validated, versioned workspace manifest. Editor library types, live `AudioBuffer` instances, signed URLs, and UI state must not escape this boundary.

Development builds expose bounded User Timing marks for OPT-01 measurement through `performance-marks.client.ts`. Marks contain lifecycle names and source indexes only—never signed URLs, Storage paths, asset IDs, filenames, track labels, or audio. Production builds emit no studio timing marks. The baseline intentionally records shell, peaks, and playback readiness together; later progressive-loading/peaks slices split those milestones without changing manifest authority.

Before adding code here, read the [system architecture](../../../../docs/technical-design/01-system-architecture.md) and [architectural decisions](../../../../docs/technical-design/decisions/README.md).

The production surface accepts a validated revision or workspace manifest, obtains one exact-authority signed batch after explicit activation, and downloads/decodes at concurrency three. Authorization failures refresh that batch once; disposal aborts outstanding work, pauses playback, and closes the owned decode context. Revision mode remains read-only. Workspace mode supports add/remove/reorder, position, trim, label, instrument, gain, pan, mute, and solo, then exports only the validated Jam Session manifest for persistence. Authorized users can render a bounded 16-bit WAV mix locally through this same browser-only boundary; source-stem downloads remain direct-to-Storage outside the adapter.

OpenDAW is a post-MVP option and must not be added here without a superseding ADR and a dedicated integration/licensing plan.

## Validated package surface

The production boundary retains the PR 05 exact pins: `@waveform-playlist/browser` 15.3.4, `@waveform-playlist/playout` 12.5.4, `tone` 15.1.22, `@dnd-kit/react` 0.3.2, and `styled-components` 6.4.3. Recording, MIDI, annotations, spectrograms, WAM, and media-element playout are intentionally not installed.

Only files in this directory may import those packages. `index.client.ts` is the lazy browser entry; it must never be re-exported from a feature-root or shared server barrel. Manifest schemas and the engine-neutral `StudioAdapter` contract remain server-import-safe.

The main browser entry supplies the React provider and waveform UI. The playout package resumes the shared audio context only after a user gesture. Jam Session IDs are mapped directly to Waveform Playlist track/clip IDs. Signed URLs remain transient inputs and must never be logged, persisted, rendered, or returned from this boundary.
