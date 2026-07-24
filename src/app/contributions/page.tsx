import type { Metadata } from "next";
import { FiCheckCircle, FiRotateCcw } from "react-icons/fi";
import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { ContributionList } from "@/features/contributions/contribution-list";
import { listContributionsByAuthor } from "@/server/repositories/contributions";
import { restoreContributionAction } from "@/features/moderation/actions";

export const metadata: Metadata = { title: "Contributions" };

export default async function ContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    after?: string;
    deleted?: string;
    restored?: string;
    restoreError?: string;
    contributionId?: string;
  }>;
}) {
  const viewer = await requireViewer("/contributions");
  const query = await searchParams;
  const status =
    query.status === "submitted" || query.status === "history"
      ? query.status
      : "active";
  const { contributions, nextCursor } = await listContributionsByAuthor(
    viewer.id,
    { status, after: query.after },
  );
  return (
    <main id="main-content">
      <Container className="py-6 sm:py-10">
        <Reveal as="header">
          <p className="text-accent-2 font-mono text-[11px] tracking-[0.2em] uppercase">
            Private proposals
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-balance sm:text-3xl">
            Keep every idea.{" "}
            <em className="text-accent font-serif font-medium">
              Know where it landed.
            </em>
          </h1>
          <p className="text-muted mt-2 max-w-[62ch] text-sm sm:text-base">
            Continue private drafts, inspect exact submissions, and follow each
            proposal back to its project.
          </p>
        </Reveal>

        {query.deleted === "1" && query.contributionId && (
          <div
            role="status"
            className="dash-card rounded-card border-accent/45 mt-5 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
          >
            <FiRotateCcw
              aria-hidden="true"
              className="text-accent shrink-0 text-lg"
            />
            <p className="text-sm">
              Contribution deleted. It remains recoverable for 30 days.
            </p>
            <form action={restoreContributionAction} className="ml-auto">
              <input
                type="hidden"
                name="contributionId"
                value={query.contributionId}
              />
              <button className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors">
                Restore contribution
              </button>
            </form>
          </div>
        )}
        {query.restored === "1" && (
          <p
            role="status"
            className="dash-card rounded-card border-accent/45 mt-5 flex items-center gap-3 px-4 py-3 text-sm sm:px-5"
          >
            <FiCheckCircle aria-hidden="true" className="text-accent text-lg" />
            Contribution restored.
          </p>
        )}
        {query.restoreError === "1" && (
          <p
            role="alert"
            className="rounded-card border-danger/50 bg-danger/8 text-danger mt-5 border px-4 py-3 text-sm"
          >
            That contribution can no longer be restored.
          </p>
        )}

        <Reveal delay={0.06} className="mt-5 overflow-x-auto pb-1">
          <nav
            aria-label="Contribution filters"
            className="dash-card rounded-card flex w-max items-center gap-1.5 p-1.5"
          >
            {(
              [
                ["active", "Active"],
                ["submitted", "Submitted"],
                ["history", "History"],
              ] as const
            ).map(([value, label]) => (
              <a
                key={value}
                aria-current={status === value ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${
                  status === value
                    ? "border-accent bg-accent/10 text-accent"
                    : "text-muted hover:border-accent-2/45 hover:text-accent-2 border-transparent"
                }`}
                href={`/contributions?status=${value}`}
              >
                {label}
              </a>
            ))}
          </nav>
        </Reveal>

        {contributions.length > 0 && (
          <Reveal
            delay={0.1}
            className="mt-6 flex flex-wrap items-baseline justify-between gap-3 px-1"
          >
            <p className="text-muted text-sm">
              <span className="text-ink font-semibold">
                {contributions.length} contribution
                {contributions.length === 1 ? "" : "s"}
              </span>{" "}
              in this view
            </p>
            <p className="text-muted hidden text-sm sm:block">
              Each card opens the exact project proposal.
            </p>
          </Reveal>
        )}

        <ContributionList contributions={contributions} filter={status} />
        {nextCursor && (
          <Reveal className="mt-8 text-center" delay={0.18}>
            <a
              className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center rounded-full border px-6 font-semibold transition-colors"
              href={`/contributions?status=${status}&after=${encodeURIComponent(nextCursor)}`}
            >
              Next contributions
            </a>
          </Reveal>
        )}
      </Container>
    </main>
  );
}
