import Link from "next/link";
import { FiArrowUpRight, FiGitPullRequest } from "react-icons/fi";
import type { AcceptedContributionHistoryItem } from "./types";

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileContributionCard({
  contribution,
}: {
  contribution: AcceptedContributionHistoryItem;
}) {
  const headingId = `profile-contribution-${contribution.revisionId}`;

  return (
    <article
      aria-labelledby={headingId}
      className="dash-card dash-card-action rounded-card group relative flex h-full min-h-48 w-full flex-col p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
          Accepted contribution
        </p>
        <span
          aria-hidden="true"
          className="border-subtle bg-surface/70 text-berry grid size-9 shrink-0 place-items-center rounded-full border"
        >
          <FiGitPullRequest />
        </span>
      </div>
      <h3
        id={headingId}
        className="mt-5 text-xl font-bold tracking-[-0.02em] text-balance"
      >
        <Link
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          href={`/projects/${contribution.projectId}`}
        >
          {contribution.projectTitle}
        </Link>
      </h3>
      <div className="text-muted mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="text-ink font-semibold">
          Revision {contribution.revisionNumber}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={contribution.acceptedAt}>
          {formatProfileDate(contribution.acceptedAt)}
        </time>
      </div>
      <p className="text-muted mt-3 text-sm">
        Credited as{" "}
        <span className="text-ink font-semibold">
          {contribution.creditName}
        </span>
      </p>
      <p className="text-accent-2 mt-auto flex items-center gap-2 pt-6 text-sm font-semibold">
        Hear the result
        <FiArrowUpRight aria-hidden="true" />
      </p>
    </article>
  );
}
