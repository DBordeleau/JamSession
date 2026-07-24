import Link from "next/link";
import { redirect } from "next/navigation";
import { FiExternalLink, FiSettings, FiUser } from "react-icons/fi";
import { Container } from "@/components/layout/container";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal.client";
import { signOut } from "@/features/auth/actions";
import { requireViewer } from "@/features/auth/guards";
import { AccountDeletionForm } from "@/features/moderation/account-deletion-form";
import { ProfileForm } from "@/features/profiles/profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertViewerAdmin } from "@/server/repositories/moderation";
import { listViewerAcceptedContributions } from "@/server/repositories/profiles";

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; avatar?: string }>;
}) {
  const profile = await requireViewer("/settings/profile");
  if (!profile.profileCompletedAt) redirect("/onboarding");
  const supabase = await createSupabaseServerClient();
  const [{ data: authData }, acceptedContributions, isAdmin] =
    await Promise.all([
      supabase.auth.getUser(),
      listViewerAcceptedContributions(profile.id),
      assertViewerAdmin(),
    ]);
  const query = await searchParams;
  const saved = query.saved === "1";

  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <Reveal
            as="header"
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                Account settings
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
                Shape your{" "}
                <em className="text-accent font-serif font-medium">
                  public presence.
                </em>
              </h1>
              {authData.user?.email && (
                <p className="text-muted mt-2 truncate text-sm">
                  Signed in as {authData.user.email}
                </p>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-2 min-[26rem]:w-auto">
              {profile.username && (
                <Link
                  className="border-strong text-muted hover:border-accent hover:text-accent inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors min-[26rem]:flex-none"
                  href={`/@${profile.username}`}
                >
                  <FiExternalLink aria-hidden="true" />
                  View profile
                </Link>
              )}
              <form action={signOut} className="flex-1 min-[26rem]:flex-none">
                <button
                  className="border-strong text-ink hover:border-accent hover:text-accent inline-flex min-h-11 w-full items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </Reveal>

          {saved && (
            <p
              role="status"
              className="dash-card rounded-card border-accent/45 mt-5 px-4 py-3 text-sm sm:px-5"
            >
              Profile saved. Your public page now carries these details.
            </p>
          )}
          {(query.avatar === "saved" || query.avatar === "reset") && (
            <p
              role="status"
              className="dash-card rounded-card border-accent/45 mt-5 px-4 py-3 text-sm sm:px-5"
            >
              {query.avatar === "saved"
                ? "Avatar saved across your profile."
                : "Avatar reset to initials."}
            </p>
          )}

          <div className="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:gap-5">
            <Reveal
              as="section"
              delay={0.08}
              className="dash-card dash-card-lit rounded-card relative p-4 sm:p-6 lg:order-2"
              aria-labelledby="avatar-settings-heading"
            >
              <div className="flex items-center gap-3">
                <div className="border-strong bg-surface/50 flex size-16 shrink-0 items-center justify-center rounded-full border shadow-[0_1rem_2rem_-1.25rem_rgb(0_0_0_/_80%)]">
                  <Avatar
                    avatarConfig={profile.avatarConfig}
                    name={profile.displayName ?? "OpenMIDI member"}
                    size="md"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-accent font-mono text-[10px] tracking-[0.16em] uppercase">
                    Local identity
                  </p>
                  <h2
                    id="avatar-settings-heading"
                    className="mt-1 text-xl font-bold tracking-[-0.02em]"
                  >
                    Your profile avatar
                  </h2>
                </div>
              </div>
              <p className="text-muted mt-4 text-sm leading-6">
                {profile.avatarConfig
                  ? "A locally generated face with no uploaded photo or remote renderer."
                  : "Initials now; build a locally generated face whenever you like."}
              </p>
              <Link
                href="/settings/avatar"
                className="cta-gradient mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold"
              >
                Customize avatar
              </Link>
            </Reveal>

            <Reveal
              as="section"
              delay={0.12}
              className="dash-card rounded-card p-4 sm:p-6 lg:order-1 lg:row-span-2"
              aria-labelledby="profile-details-heading"
            >
              <div className="flex items-center gap-3">
                <span className="border-accent/35 bg-accent/10 text-accent flex size-10 shrink-0 items-center justify-center rounded-full border">
                  <FiUser aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="profile-details-heading"
                    className="text-xl font-bold tracking-[-0.02em]"
                  >
                    Profile details
                  </h2>
                  <p className="text-muted mt-0.5 text-sm">
                    The name and story musicians see beside your work.
                  </p>
                </div>
              </div>
              <ProfileForm profile={profile} variant="settings" />
            </Reveal>
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2 lg:gap-5">
            <Reveal
              as="section"
              delay={0.16}
              className="dash-card rounded-card p-4 sm:p-6"
              aria-labelledby="accepted-contributions-heading"
            >
              <h2
                id="accepted-contributions-heading"
                className="text-xl font-bold tracking-[-0.02em]"
              >
                Accepted contributions
              </h2>
              <p className="text-muted mt-1 text-sm">
                Exact revisions where your work became part of the arrangement.
              </p>
              {acceptedContributions.length ? (
                <ol className="mt-4 space-y-2.5">
                  {acceptedContributions.map((item) => (
                    <li
                      className="rounded-control border-subtle hover:border-accent-2 border p-3 transition-colors"
                      key={item.revisionId}
                    >
                      <Link
                        className="hover:text-accent font-semibold transition-colors"
                        href={`/projects/${item.projectId}#revision-${item.revisionNumber}`}
                      >
                        {item.projectTitle} · revision {item.revisionNumber}
                      </Link>
                      <p className="text-muted mt-1 text-sm">
                        Credited as {item.creditName} ·{" "}
                        <time dateTime={item.acceptedAt}>
                          {new Date(item.acceptedAt).toLocaleDateString()}
                        </time>
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="border-subtle text-muted rounded-control mt-4 border border-dashed p-4 text-sm">
                  No accepted contributions yet. When a proposal lands, its
                  credit trail will stay here.
                </p>
              )}
            </Reveal>

            {isAdmin && (
              <Reveal
                as="section"
                delay={0.18}
                className="dash-card rounded-card p-4 sm:p-6"
                aria-labelledby="administration-heading"
              >
                <div className="flex items-center gap-3">
                  <span className="border-accent-2/35 bg-accent-2/10 text-accent-2 flex size-10 shrink-0 items-center justify-center rounded-full border">
                    <FiSettings aria-hidden="true" />
                  </span>
                  <h2
                    id="administration-heading"
                    className="text-xl font-bold tracking-[-0.02em]"
                  >
                    Administration
                  </h2>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors"
                    href="/admin/moderation"
                  >
                    Moderation queue
                  </Link>
                  <Link
                    className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors"
                    href="/admin/operations"
                  >
                    Retention operations
                  </Link>
                </div>
              </Reveal>
            )}
          </div>

          {profile.username && (
            <Reveal
              as="section"
              delay={0.2}
              className="rounded-card border-danger/45 bg-danger/5 mt-4 border p-4 sm:p-6"
              aria-labelledby="delete-account-heading"
            >
              <p className="text-danger font-mono text-[10px] tracking-[0.16em] uppercase">
                Danger zone
              </p>
              <h2
                id="delete-account-heading"
                className="mt-2 text-xl font-bold tracking-[-0.02em]"
              >
                Delete account
              </h2>
              <p className="text-muted mt-2 max-w-[78ch] text-sm leading-6">
                Your profile and owned projects disappear immediately. You can
                recover for 30 days when moderation permits. Published credits
                and fork lineage survive as unavailable history. Your generated
                avatar configuration is cleared immediately. Existing access
                tokens can remain valid until their short expiry, so OpenMIDI
                continues enforcing deleted-account checks at every protected
                boundary.
              </p>
              <AccountDeletionForm username={profile.username} />
            </Reveal>
          )}
        </div>
      </Container>
    </main>
  );
}
