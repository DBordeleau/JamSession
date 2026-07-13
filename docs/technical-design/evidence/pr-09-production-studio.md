# PR 09 production studio playback evidence

Status: automated implementation verified; manual browser/Preview matrix pending  
Date: 2026-07-13

## Implemented contract

`/projects/[projectId]/studio` is an authenticated, exact-current-revision Server Component. It sends only validated manifest and display metadata to a small launcher. The launcher checks desktop capabilities and dynamically imports the Waveform Playlist surface only after **Open studio**.

`POST /api/projects/[projectId]/revisions/[revisionId]/audio-sources` accepts a strict, unique set of at most 12 asset UUIDs. The set must exactly equal the immutable manifest. A caller-scoped Supabase client reads RLS-authorized `ready` source assets and calls one `createSignedUrls` batch with a 600-second lifetime. Responses are `private, no-store` and contain only asset ID, signed URL, and expiry. No service role is used.

Downloads/decode run at concurrency three. Concurrent `401`/`403` failures share one forced batch refresh and one retry. `404`, repeated authorization failure, network failure, decode failure, and cancellation are distinct typed states. A failed track prevents partial playback. Unmount/pagehide aborts work, pauses playback, detaches shortcuts/listeners, and disposes owned decode resources.

Playback uses Waveform Playlist's single transport/playhead. Controls include play/pause, ±5-second seek, bounded time display, seek slider, gain, pan, mute, and solo. Space and arrow shortcuts ignore form/contenteditable focus. Mixer changes are explicitly session-only and no persistence path is called.

## Authorization evidence

The forward migration preserves owner upload/read behavior and extends project, revision, asset, and object reads to active completed members. Referenced membership, `source_audio`, `ready`, non-deleted state, and exact bucket/path match are all required. pgTAP covers owner/member allows and unrelated, suspended, anonymous, unreferenced, and mismatched-object denies; the existing Storage INSERT policy remains present.

## Package and performance surface

Pinned packages remain `@waveform-playlist/browser@15.3.4`, `@waveform-playlist/playout@12.5.4`, and `tone@15.1.22`. Editor/audio imports remain inside the adapter directory. Normal open performs one signing call and no source request occurs before explicit activation. Source work is capped at three concurrent tasks. The PR 05 decoded-memory warning remains applicable: decoded PCM can greatly exceed compressed upload size at the 12 × 45 MiB project ceiling.

Raw/compressed production chunk transfer and open-to-ready time require final production build/Preview measurement. Chromium audible synchronization, Firefox, Safari/macOS, and Vercel Preview HTTPS/CORS checks were unavailable in this implementation environment and are not claimed as passed.

## Verification record

- Clean local database reset and migration application: run.
- Database lint, pgTAP, and generated type drift: run.
- Focused adapter/source loader tests: run.
- Repository lint/type/unit/build and production E2E: recorded in the implementation handoff with exact outcomes.

The PR 05 evidence remains historical. Its spike route, test-only local persistence, fixture UI, export controls, and spike E2E were removed after the production route replaced the lazy-boundary behavior.
