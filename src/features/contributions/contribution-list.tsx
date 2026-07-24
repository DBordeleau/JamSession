import type { IconType } from "react-icons";
import {
  FiArchive,
  FiArrowRight,
  FiCheck,
  FiEdit3,
  FiMessageCircle,
  FiSend,
  FiX,
} from "react-icons/fi";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal.client";
import type { ContributionListItem, ContributionStatus } from "./types";

const statusPresentation: Record<
  ContributionStatus,
  { label: string; Icon: IconType; className: string }
> = {
  draft: {
    label: "Draft",
    Icon: FiEdit3,
    className: "border-subtle bg-ink/[0.04] text-muted",
  },
  submitted: {
    label: "Submitted",
    Icon: FiSend,
    className: "border-accent-2/45 bg-accent-2/10 text-accent-2",
  },
  changes_requested: {
    label: "Changes requested",
    Icon: FiMessageCircle,
    className: "border-danger/45 bg-danger/10 text-danger",
  },
  accepted: {
    label: "Accepted",
    Icon: FiCheck,
    className: "border-accent/45 bg-accent/10 text-accent",
  },
  rejected: {
    label: "Rejected",
    Icon: FiX,
    className: "border-danger/45 bg-danger/10 text-danger",
  },
  withdrawn: {
    label: "Withdrawn",
    Icon: FiArchive,
    className: "border-strong border-dashed text-muted",
  },
};

type ContributionFilter = "active" | "submitted" | "history";

const emptyStates: Record<
  ContributionFilter,
  { title: string; message: string }
> = {
  active: {
    title: "No contributions in motion.",
    message:
      "Find an open project, shape a private draft, and send it when the idea is ready.",
  },
  submitted: {
    title: "Nothing is waiting on review.",
    message:
      "Submitted proposals stay here while a project owner listens through the changes.",
  },
  history: {
    title: "Your finished proposals will collect here.",
    message:
      "Accepted, rejected, and withdrawn contributions keep their exact project destination.",
  },
};

function formatDuration(durationMs: number | undefined) {
  if (durationMs === undefined) return null;
  return `${(durationMs / 1000).toFixed(1)} sec`;
}

function StatusBadge({ status }: { status: ContributionStatus }) {
  const { label, Icon, className } = statusPresentation[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] uppercase ${className}`}
    >
      <Icon aria-hidden="true" className="shrink-0 text-[12px]" />
      {label}
    </span>
  );
}

function ComparisonState({
  contribution,
}: {
  contribution: ContributionListItem;
}) {
  if (
    contribution.baseRevisionNumber !== undefined &&
    contribution.currentRevisionNumber !== undefined
  )
    return (
      <>
        Revision {contribution.baseRevisionNumber ?? "—"} →{" "}
        {contribution.currentRevisionNumber ?? "—"}
        {contribution.isStale !== undefined && (
          <span
            className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9.5px] tracking-[0.1em] uppercase ${
              contribution.isStale
                ? "border-danger/40 bg-danger/10 text-danger"
                : "border-accent/40 bg-accent/10 text-accent"
            }`}
          >
            {contribution.isStale ? (
              <FiMessageCircle aria-hidden="true" />
            ) : (
              <FiCheck aria-hidden="true" />
            )}
            {contribution.isStale ? "Base is behind" : "Base is current"}
          </span>
        )}
      </>
    );

  return contribution.currentVersionNumber
    ? "Exact submitted base preserved"
    : "Starts from an exact project revision";
}

export function ContributionList({
  contributions,
  filter = "active",
}: {
  contributions: ContributionListItem[];
  filter?: ContributionFilter;
}) {
  if (contributions.length === 0) {
    const empty = emptyStates[filter];
    return (
      <Reveal
        as="section"
        delay={0.1}
        className="dash-card rounded-card mt-4 border border-dashed p-8 text-center sm:p-10"
      >
        <p className="text-accent font-mono text-[10.5px] tracking-[0.18em] uppercase">
          Clear session
        </p>
        <h2 className="mt-2 text-xl font-bold sm:text-2xl">{empty.title}</h2>
        <p className="text-muted mx-auto mt-2 max-w-[52ch] text-sm sm:text-base">
          {empty.message}
        </p>
        <Link
          prefetch={false}
          className="cta-gradient mt-5 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
          href="/explore"
        >
          Explore open projects
        </Link>
      </Reveal>
    );
  }

  return (
    <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contributions.map((contribution, index) => {
        const destination = `/projects/${contribution.projectId}/contributions/${contribution.id}`;
        const duration = formatDuration(contribution.durationMs);
        return (
          <Reveal
            as="li"
            className="flex"
            delay={0.12 + Math.min(index, 8) * 0.05}
            key={contribution.id}
          >
            <article className="dash-card dash-card-action rounded-card group relative flex w-full flex-col p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={contribution.status} />
                {contribution.currentVersionNumber ? (
                  <span className="text-muted ml-auto font-mono text-[10.5px] tracking-[0.12em] uppercase">
                    Version {contribution.currentVersionNumber}
                  </span>
                ) : (
                  <span className="text-muted ml-auto font-mono text-[10.5px] tracking-[0.12em] uppercase">
                    Private workspace
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-xl font-bold tracking-[-0.025em] text-balance">
                <Link
                  className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
                  href={destination}
                >
                  {contribution.title}
                </Link>
              </h2>
              <p className="text-muted mt-1 text-sm">
                For{" "}
                <span className="text-ink font-semibold">
                  {contribution.projectTitle}
                </span>
              </p>

              <dl className="border-subtle mt-4 grid gap-3 border-t pt-4 text-sm">
                <div>
                  <dt className="text-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    Arrangement
                  </dt>
                  <dd className="text-ink/90 mt-1">
                    {contribution.currentVersionNumber
                      ? [
                          contribution.trackCount !== undefined
                            ? `${contribution.trackCount} ${
                                contribution.trackCount === 1
                                  ? "track"
                                  : "tracks"
                              }`
                            : "Immutable snapshot",
                          duration,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "Private draft · not submitted"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    Base comparison
                  </dt>
                  <dd className="text-ink/90 mt-1">
                    <ComparisonState contribution={contribution} />
                  </dd>
                </div>
              </dl>

              <div className="border-subtle mt-auto flex items-center gap-3 border-t pt-4">
                <p className="text-muted text-xs">
                  Updated{" "}
                  <time dateTime={contribution.updatedAt}>
                    {new Date(contribution.updatedAt).toLocaleString()}
                  </time>
                </p>
                <span className="text-accent ml-auto inline-flex items-center gap-1 text-sm font-semibold">
                  Open
                  <FiArrowRight
                    aria-hidden="true"
                    className="transition-transform group-focus-within:translate-x-1 group-hover:translate-x-1 motion-reduce:translate-x-0 motion-reduce:transition-none"
                  />
                </span>
              </div>
            </article>
          </Reveal>
        );
      })}
    </ul>
  );
}
