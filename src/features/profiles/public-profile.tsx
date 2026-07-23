import Link from "next/link";
import { FiFlag, FiFolder, FiGitPullRequest } from "react-icons/fi";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal.client";
import { AwardGallery } from "@/features/awards/award-gallery";
import type { PublicProfileAward } from "@/features/awards/contract";
import { ProfileContributionCard } from "./profile-contribution-card";
import { ProfileEmptyState } from "./profile-empty-state";
import { ProfileProjectCard } from "./profile-project-card";
import type {
  AcceptedContributionHistoryItem,
  PublicProfile,
  PublicProfileProject,
} from "./types";

export function PublicProfileView({
  profile,
  projects,
  contributions,
  awards,
  projectNextHref,
  contributionNextHref,
  awardNextHref,
  cursorStale = false,
}: {
  profile: PublicProfile;
  projects: PublicProfileProject[];
  contributions: AcceptedContributionHistoryItem[];
  awards: PublicProfileAward[];
  projectNextHref: string | null;
  contributionNextHref: string | null;
  awardNextHref: string | null;
  cursorStale?: boolean;
}) {
  return (
    <article className="mx-auto max-w-6xl">
      <Reveal as="header">
        <div className="dash-card dash-card-lit rounded-card border-subtle relative overflow-hidden border p-5 sm:p-7 lg:p-8">
          <div
            aria-hidden="true"
            className="bg-accent/10 absolute -top-20 -right-20 size-64 rounded-full blur-3xl"
          />
          <div
            aria-hidden="true"
            className="bg-berry/10 absolute -bottom-28 left-1/3 size-64 rounded-full blur-3xl"
          />
          <div className="relative grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8">
            <div className="border-strong bg-surface/50 relative flex size-32 items-center justify-center rounded-full border shadow-[0_1.5rem_3rem_-1.5rem_rgb(0_0_0_/_80%)] sm:size-36">
              <div
                aria-hidden="true"
                className="from-accent/50 to-accent-2/30 absolute inset-2 rounded-full bg-linear-to-br opacity-60 blur-xl"
              />
              <div className="relative flex">
                <Avatar
                  avatarConfig={profile.avatarConfig}
                  name={profile.displayName}
                  size="lg"
                />
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
                Artist profile
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-balance sm:text-4xl lg:text-5xl">
                {profile.displayName}
              </h1>
              <p className="text-accent mt-2 text-base font-semibold sm:text-lg">
                @{profile.username}
              </p>

              {profile.bio ? (
                <p className="text-ink/90 mt-5 max-w-[58ch] text-base leading-7 whitespace-pre-wrap sm:text-lg sm:leading-8">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-muted mt-5 max-w-[52ch] text-sm leading-6">
                  Their public work, collaborations, and challenge recognition
                  live here.
                </p>
              )}

              <div className="border-subtle mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-5">
                <p className="min-w-0 text-sm">
                  <span className="text-muted block font-mono text-[10px] tracking-[0.16em] uppercase">
                    MIDI credits
                  </span>
                  <span className="mt-1 block font-semibold break-words">
                    {profile.creditName}
                  </span>
                </p>
                <Link
                  className="border-strong text-muted hover:border-accent hover:text-accent inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors sm:ml-auto"
                  href={`/reports/new?kind=profile&id=${profile.id}&label=${encodeURIComponent(`@${profile.username}`)}`}
                >
                  <FiFlag aria-hidden="true" />
                  Report this profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {cursorStale && (
        <Reveal delay={0.04}>
          <p
            role="status"
            className="border-accent bg-surface/80 rounded-card mt-5 border px-5 py-4"
          >
            This profile changed while you were browsing. Showing the newest
            results.
          </p>
        </Reveal>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
        <Reveal
          as="section"
          delay={0.06}
          aria-labelledby="profile-projects-heading"
        >
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
                Body of work
              </p>
              <h2
                id="profile-projects-heading"
                className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
              >
                Public MIDI projects
              </h2>
            </div>
            {projects.length > 0 && (
              <p className="text-muted text-sm">
                Published arrangements, ready to hear.
              </p>
            )}
          </div>

          {projects.length > 0 ? (
            <ul className="grid gap-4">
              {projects.map((project, index) => (
                <Reveal
                  as="li"
                  key={project.projectId}
                  delay={0.1 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  <ProfileProjectCard project={project} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <ProfileEmptyState
              Icon={FiFolder}
              title="The set list is still open."
              message="When this artist publishes a MIDI project, it will become part of their public body of work here."
            />
          )}
          {projectNextHref && (
            <Link
              className="border-strong hover:border-accent hover:text-accent mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
              href={projectNextHref}
            >
              Next projects
            </Link>
          )}
        </Reveal>

        <Reveal
          as="section"
          delay={0.12}
          aria-labelledby="profile-contributions-heading"
        >
          <div className="mb-4 px-1">
            <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
              In the mix
            </p>
            <h2
              id="profile-contributions-heading"
              className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
            >
              Accepted contributions
            </h2>
          </div>

          {contributions.length > 0 ? (
            <ul className="grid gap-4">
              {contributions.map((contribution, index) => (
                <Reveal
                  as="li"
                  key={contribution.revisionId}
                  delay={0.16 + Math.min(index, 8) * 0.05}
                  className="flex"
                >
                  <ProfileContributionCard contribution={contribution} />
                </Reveal>
              ))}
            </ul>
          ) : (
            <ProfileEmptyState
              Icon={FiGitPullRequest}
              title="No accepted contributions yet."
              message="Collaborative parts that make it into a public arrangement will be credited here."
            />
          )}
          {contributionNextHref && (
            <Link
              className="border-strong hover:border-accent hover:text-accent mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
              href={contributionNextHref}
            >
              Next contributions
            </Link>
          )}
        </Reveal>
      </div>

      <Reveal delay={0.18} className="mt-6">
        <AwardGallery awards={awards} nextHref={awardNextHref} />
      </Reveal>
    </article>
  );
}
