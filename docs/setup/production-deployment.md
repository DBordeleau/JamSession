# Production deployment

OpenMIDI's invite-only beta is hosted at `https://open-midi.vercel.app/` in the existing Vercel project `open-midi`, backed by the retained Supabase project `xjfynngyqywnllgotvcw`.

## Verified RELEASE-03 rollout artifact

- Verified application commit: `732d104`
- Verified production deployment: `dpl_2Mc9qAVYT7QUKS26MUH8DnheCpvq`
- Verified preview source: `dpl_4ZhgCC45mFCr4Nj6wN41LB4E7PgT`
- Production deployment preceding that rollout: `dpl_CGsF5VvPi7d5n8rSf3zmu7266LK3`

These identifiers record the RELEASE-03 rollout. They are not permanent pointers to the deployment currently serving production or to a universal rollback target.

The application environment contains only the public Supabase URL/publishable key and exact `SITE_URL` needed by the browser/server application. Google OAuth secrets remain in Supabase/Google provider configuration, and service-role credentials are not Vercel application variables. `.vercel/`, local environments, dependencies, and generated build/test output are excluded from deployment uploads.

## Deploy and verify

1. Start from a clean reviewed commit and run `npm run check`.
2. Deploy a preview with `npx vercel deploy --yes`.
3. Inspect the exact preview deployment and run signed-out smoke. Complete account-scoped checks through an invited account at the approved origin.
4. Obtain explicit production approval naming the exact preview deployment.
5. Promote only that deployment, then verify `https://open-midi.vercel.app/` resolves to the resulting production deployment.
6. Check public routes, protected redirects, `/test-auth` returning 404, representative MIDI preview responses, and Vercel runtime errors/log status.

For changes that can affect navigation request fanout, add one bounded $0 observation after the narrow smoke:

1. Confirm the exact commit, deployment ID, readiness, and production alias.
2. Use a fixed observation window and group sanitized request counts separately as Edge Requests, Function Invocations, cache hits, and middleware.
3. Run one controlled private-browser sign-in â†’ Studio â†’ project-open journey, then leave the ready Studio untouched for 60 seconds.
4. Confirm that rendering global navigation does not request unrelated destinations before pointer/keyboard intent and that idle Studio produces no application request loop.
5. Record direct Supabase requests and browser-local MIDI activity separately; never record credentials, cookies, emails, full query strings, manifests, or private identifiers.

The detailed policy, provisional request budgets, and baseline limitations are recorded in the [PERF-01 evidence](../technical-design/evidence/perf-01-production-request-fanout.md). Hobby observability limitations must be reported rather than hidden or supplemented with a paid processor.

This repository is connected to Vercel. Every merge into the configured production branch can create a production deployment. After merge, the operator must wait for that deployment to become ready, record its exact source commit and deployment ID, confirm the production alias resolves to it, and repeat the applicable narrow production smoke before considering the merged state verified.

Creating or promoting an application deployment does not mutate Supabase schema, data, migration history, Auth/provider configuration, or imported seed state. Those remain separate hosted mutations requiring their own exact target checks and authority.

## Rollback

For an application regression, preserve the forward-only database and first inspect deployment history:

```powershell
npx vercel ls open-midi --yes
npx vercel inspect https://open-midi.vercel.app
npx vercel inspect <preceding-deployment-id-or-url>
```

Identify the exact previously verified deployment from release evidence and deployment history. Confirm that its commit, environment, readiness, and expected application state are the intended rollback target; do not infer the target from age or reuse a historical ID without checking it. Only then run:

```powershell
npx vercel rollback <confirmed-previous-deployment-id> --yes
```

Wait for rollback completion, verify the production alias resolves to the confirmed target, and repeat the narrow production smoke before reopening the beta. Do not roll back database migrations, rerun the RELEASE-01 destructive reconciliation, or delete seed lineage ad hoc. Provider rollback restores only previously recorded safe Site URL/redirect/OAuth values. Seed containment uses project visibility, library unlisting, challenge cancellation, or audited moderation from the beta operations runbook.
