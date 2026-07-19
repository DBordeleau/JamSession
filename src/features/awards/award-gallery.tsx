import Link from "next/link";
import type { PublicProfileAward } from "./contract";
import { AwardCard } from "./award-card";

export function AwardGallery({
  awards,
  nextHref,
}: {
  awards: PublicProfileAward[];
  nextHref: string | null;
}) {
  return (
    <section
      className="border-subtle mt-10 border-t pt-8"
      aria-labelledby="awards-heading"
    >
      <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
        Recognition
      </p>
      <h2 id="awards-heading" className="mt-2 text-2xl font-bold">
        Awards
      </h2>
      {awards.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {awards.map((award) => (
            <AwardCard key={award.id} award={award} />
          ))}
        </div>
      ) : (
        <p className="text-muted mt-3">
          No current challenge awards yet. Completed challenge recognition will
          appear here.
        </p>
      )}
      {nextHref && (
        <Link
          className="border-strong mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold"
          href={nextHref}
        >
          Next awards
        </Link>
      )}
    </section>
  );
}
