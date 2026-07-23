import Link from "next/link";
import { FiArrowUpRight, FiMusic } from "react-icons/fi";
import type { PublicProfileProject } from "./types";

function formatProfileDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProfileProjectCard({
  project,
}: {
  project: PublicProfileProject;
}) {
  const headingId = `profile-project-${project.projectId}`;

  return (
    <article
      aria-labelledby={headingId}
      className="dash-card dash-card-lit dash-card-action rounded-card group relative flex h-full min-h-48 w-full flex-col overflow-hidden p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-accent font-mono text-[10.5px] tracking-[0.16em] uppercase">
          Published MIDI project
        </p>
        <span
          aria-hidden="true"
          className="border-subtle bg-surface/70 text-accent-2 grid size-9 shrink-0 place-items-center rounded-full border"
        >
          <FiMusic />
        </span>
      </div>
      <h3
        id={headingId}
        className="mt-5 text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl"
      >
        <Link
          className="group-hover:text-accent transition-colors after:absolute after:inset-0 after:rounded-[inherit]"
          href={`/projects/${project.projectId}`}
        >
          {project.title}
        </Link>
      </h3>
      <p className="text-muted mt-2 text-sm">
        Published{" "}
        <time dateTime={project.publishedAt}>
          {formatProfileDate(project.publishedAt)}
        </time>
      </p>
      <p className="text-accent-2 mt-auto flex items-center gap-2 pt-6 text-sm font-semibold">
        Open project
        <FiArrowUpRight aria-hidden="true" />
      </p>
    </article>
  );
}
