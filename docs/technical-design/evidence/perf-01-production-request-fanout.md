# PERF-01 production request fanout

Date: 2026-07-19

Outcome: Global navigation no longer opts into Next.js viewport prefetch before user intent; post-merge production measurement remains required

## Baseline and limitations

PR #66 was merged at `5b270a1`, and its automatic production deployment `dpl_32onURmmj7uBGUQ8HEj9gfsK4tok` reached `READY`. By the time PERF-01 began, later Studio styling commits had superseded that deployment. The production alias resolved to ready deployment `dpl_8xcHva4QwYwGQWo5tRCXkUEKKAHL`, and Vercel reported no runtime error cluster in the sampled hour.

A bounded read-only production-log snapshot for approximately 2026-07-19 16:10â€“17:10 UTC reported:

| Runtime-log source | Requests |
| ------------------ | -------: |
| Function           |      170 |
| Cache              |       11 |
| Middleware         |        6 |

The leading non-sensitive application paths included `/` (17), `/sign-in` (16), `/projects` (13), `/community-rules` (10), `/projects/new` (9), `/library` (8), `/dashboard` (7), `/challenges` (7), `/studio` (7), `/explore` (6), `/settings/profile` (6), `/contributions` (6), and `/reports` (4). This repeats the earlier directional shape: routes represented by global navigation appeared together without one Studio endpoint dominating the sample.

This is not a clean session benchmark. The window includes deployment, smoke, operator, and unrelated activity, and the Hobby log view does not provide a paid-grade causal trace from one browser action to every request. The exact post-merge deployment also required deployment-protection context for most direct route fetches. Therefore:

- the source totals are categorized runtime-log entries, not an exact Edge Requests billing export;
- Function entries indicate dynamic application work but cannot all be attributed to one user or prefetch;
- cache entries are Edge Requests served without a Function Invocation;
- middleware entries are separate from Studio, which is outside the repository proxy matcher;
- browser requests sent directly to Supabase are not Vercel Edge Requests and do not appear in this Vercel sample; and
- Tone.js playback, playhead updates, MIDI rendering, and other browser-local work are not network requests.

The previous RELEASE-03 directional sample of 253 Function, 26 Cache, and 10 Middleware requests over one hour remains useful corroboration, not a before/after total for PERF-01.

## Root cause

The shared header initially rendered signed-out section and sign-in links, then replaced them with eight authenticated application destinations and account links after verified browser claims resolved. The brand route and both link sets used default Next.js `Link` behavior. The shared footer added another always-visible route set outside Studio.

Next.js 16 automatically prefetches eligible visible links in production. Its documented intent-prefetch pattern starts with `prefetch={false}` and restores the framework default with `prefetch={null}` after intent. Vercel Edge Requests count CDN requests broadly, while Function Invocations are the subset that execute a Function; cache hits do not invoke a Function. The baseline must not treat these categories as synonyms.

Official references:

- [Next.js prefetching guide](https://nextjs.org/docs/app/guides/prefetching)
- [Vercel query metric reference](https://vercel.com/docs/query/reference)
- [Vercel Functions](https://vercel.com/docs/functions)

## Implemented policy

- `IntentPrefetchLink` renders a normal Next.js `Link`, initially passes `prefetch={false}`, and permanently switches to `prefetch={null}` after pointer enter, mouse enter, or keyboard focus.
- The primitive forwards the caller's href, children, class name, accessible attributes, navigation props, and event handlers. It adds no timer, observer, polling, analytics, dependency, or routing API.
- The shared-header brand link, signed-out section links, Sign in, authenticated desktop/mobile primary destinations, and both Account actions use intent-prefetch.
- Every ordinary shared-footer link passes `prefetch={false}`.
- Footer `AuthAwareLink` passes a narrowly typed `prefetch={false}` override while preserving its signed-out-first fallback, verified-claims refresh, Auth listener cleanup, label, and icon behavior.
- The signed-out-first header remains visible while claims resolve and remains display-only, never an authorization boundary.

No copy, styling, route, active-state, proxy, Auth authorization, cache, database, Storage, Studio autosave, publication, playback, or lifecycle behavior changed. Three inherited Studio files received only the explicitly authorized Prettier repair required to restore the existing `npm run check` gate.

## Secondary-link audit

No repeated project, library, challenge, contribution, or profile list component changed. Dynamic detail paths appeared in the contaminated baseline, but the sample did not prove that viewport exposure initiated them. Changing those components without a controlled request initiator would be speculative and would exceed PERF-01.

After deployment, if a controlled browser trace names an unsolicited dynamic route and proves a repeated component initiated it before intent, optimize only that owning component in a separate evidence-backed change.

## Verification

Focused component coverage proves:

- initial `prefetch={false}` and stable `prefetch={null}` after mouse, pointer, or keyboard intent;
- ordinary href, accessible content, `aria-current`, class name, click, and caller intent handlers are preserved;
- desktop and mobile primary-navigation copies start cold while one focused copy can warm independently;
- the signed-out-to-signed-in header transition keeps both link sets cold;
- every footer destination remains no-prefetch; and
- `AuthAwareLink` preserves the footer policy across its verified-claims transition.

Verification completed as follows:

- focused intent-prefetch, primary-navigation, header, footer, and `AuthAwareLink` tests: passed (5 files, 13 tests);
- `npm run typecheck`: passed;
- `npm run check`: passed, including formatting, lint, strict types, unit tests, and the production build;
- `git diff --check`: passed; and
- `npm run test:e2e:identity`: unavailable after two preflight attempts because the local Supabase stack was stopped and the corrected startup attempt found Docker Desktop's Linux engine unavailable. No browser test executed, and the existing Auth or navigation assertions were not weakened.

No database validation command was run because there is no database change. The corrected identity preflight attempted only the documented local reduced Auth stack; it did not reach a local reset or test execution and did not contact hosted Supabase.

Studio runtime files were not semantically changed for PERF-01. Source inspection confirms autosave still schedules only after manifest edits, the shared footer remains absent on Studio routes, proxy coverage remains unchanged, playback stays in the browser-only MIDI runtime, and dirty/saving navigation continues through the existing lifecycle coordinator. A production 60-second idle trace remains part of the post-merge measurement because development mode does not reproduce automatic viewport prefetch.

## Measured outcome and provisional targets

No controlled after measurement is claimed before the automatic production deployment exists. Deterministic tests prove that rendering global chrome alone cannot opt its links into viewport prefetch, but they do not convert the contaminated baseline into a percentage reduction.

After merge, repeat one fresh sign-in â†’ Studio â†’ project-open journey and one 60-second untouched Studio idle period. The targets remain unchanged:

- at least 70% fewer unsolicited navigation-attributable Function requests;
- zero unrelated global destinations requested solely because the Studio header rendered;
- zero new OpenMIDI application requests during the idle period after readiness; and
- provisionally no more than 100 Edge Requests and 25 Function Invocations for the full controlled journey.

If framework-required traffic exceeds a provisional total while unrelated-route fanout is zero, record the categorized result and request approval before revising the budget.

## Expected remaining requests

Expected traffic includes the requested page/RSC response, immutable framework assets, deliberate hover/focus warming, deliberate navigation, verified Auth claim or token activity, authorized Server Actions after an actual edit or mutation, and platform health or operator checks that are explicitly identified. Direct Supabase traffic and browser-local playback activity must remain separate from Vercel request totals.

## $0 monitoring procedure

1. Confirm the exact production deployment ID, commit, readiness, and alias without printing credentials.
2. Use one fixed Vercel Hobby observation window and group runtime logs separately by source and sanitized application path.
3. In a fresh private browser context, perform one controlled invited-account sign-in â†’ Studio â†’ project-open journey, then leave Studio untouched for 60 seconds.
4. Record Edge Requests, Function Invocations, cache hits, middleware, direct Supabase traffic, and browser-local activity as separate categories. Never record cookies, tokens, emails, full query strings, manifests, or private identifiers.
5. Compare only like-for-like journeys and note bots, CI, deploy smoke, health checks, or operator traffic contaminating the window.

No paid observability, drain, external processor, or hosted Supabase mutation is required.

## Rollback

Revert the application Link policy and redeploy the previously verified application artifact. Do not change Supabase schema, migration history, Auth/provider configuration, Storage, seed state, or hosted data. If only one destination regresses, the safe immediate fallback is `prefetch={false}` for that link. Repeat keyboard, pointer, signed-out/signed-in, and narrow production smoke after rollback.
