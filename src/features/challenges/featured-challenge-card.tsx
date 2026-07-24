import { ButtonLink } from "@/components/ui/button";
import { formatRemaining, nextChallengeMilestone } from "./challenge-countdown";
import { describeChallengeConstraintsV1 } from "./constraint-v1";
import { challengePhaseMessage } from "./lifecycle";
import type { FeaturedChallenge } from "./types";

export function FeaturedChallengeCard({
  featured,
}: {
  featured: FeaturedChallenge | null;
}) {
  if (!featured)
    return (
      <section
        className="dash-card dash-card-lit rounded-card relative p-4 sm:p-5"
        aria-labelledby="featured-challenge-heading"
      >
        <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
          Challenge desk
        </p>
        <h3
          id="featured-challenge-heading"
          className="mt-2 text-xl font-bold tracking-[-0.03em] sm:text-2xl"
        >
          The next constraint is being tuned
        </h3>
        <p className="text-muted mt-2 text-sm">
          Browse completed challenges while the next curated session is
          prepared.
        </p>
        <div className="mt-4">
          <ButtonLink href="/challenges" variant="secondary" prefetch={false}>
            Browse challenges
          </ButtonLink>
        </div>
      </section>
    );

  const { challenge } = featured;
  // The dashboard is a doorway, not the brief. An unfamiliar future
  // constraint should cost a few chips, never the whole launcher.
  let rules: string[] = [];
  try {
    rules = describeChallengeConstraintsV1(challenge.constraints).slice(0, 3);
  } catch {
    rules = [];
  }
  const phaseLabel = challengePhaseMessage({
    phase: challenge.phase,
    votingOpensAt: challenge.votingOpensAt,
    votingClosesAt: challenge.votingClosesAt,
  });
  const milestone = nextChallengeMilestone(challenge);
  const remaining = milestone ? formatRemaining(milestone.at) : null;
  const actionLabel = {
    draft: "View the brief",
    scheduled: "View the brief",
    open: "Enter the challenge",
    voting: "Hear the entries",
    completed: "See the results",
    cancelled: "View the archive",
  }[challenge.phase];

  return (
    <section
      className="dash-card dash-card-lit rounded-card relative overflow-hidden p-4 sm:p-5"
      aria-labelledby="featured-challenge-heading"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="border-accent/45 bg-accent/12 text-accent rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase">
          {phaseLabel}
        </span>
        {milestone && remaining ? (
          <span
            className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs ${
              milestone.urgent
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-accent-2/35 bg-accent-2/8 text-accent-2"
            }`}
          >
            {milestone.label}{" "}
            <strong>
              {remaining.value} {remaining.unit}
            </strong>
          </span>
        ) : (
          <span className="text-muted ml-auto font-mono text-[10px] tracking-[0.12em] uppercase">
            {featured.label}
          </span>
        )}
      </div>

      <h3
        id="featured-challenge-heading"
        className="mt-3 text-xl font-bold tracking-[-0.03em] text-balance sm:text-2xl"
      >
        {challenge.title}
      </h3>
      <p className="text-accent-2 mt-1.5 text-sm font-semibold text-balance sm:text-base">
        {challenge.prompt}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        {rules.length > 0 && (
          <ul className="flex flex-1 flex-wrap gap-1.5">
            {rules.map((rule) => (
              <li
                key={rule}
                className="border-accent-2/30 bg-accent-2/8 text-accent-2 rounded-full border px-2.5 py-0.5 text-xs"
              >
                {rule.replace(/\.$/, "")}
              </li>
            ))}
          </ul>
        )}
        <div className="ml-auto">
          <ButtonLink href={`/challenges/${challenge.slug}`} prefetch={false}>
            {actionLabel}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
