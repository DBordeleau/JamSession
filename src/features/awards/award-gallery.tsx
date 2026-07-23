import Link from "next/link";
import { FiAward } from "react-icons/fi";
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
    <section className="relative" aria-labelledby="awards-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-accent font-mono text-[11px] tracking-[0.2em] uppercase">
            Challenge recognition
          </p>
          <h2
            id="awards-heading"
            className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl"
          >
            Earned in the room
          </h2>
        </div>
        {awards.length > 0 && (
          <p className="text-muted max-w-[38ch] text-sm">
            Each badge stays linked to the exact challenge result that earned
            it.
          </p>
        )}
      </div>
      {awards.length ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {awards.map((award) => (
            <AwardCard key={award.id} award={award} />
          ))}
        </div>
      ) : (
        <div className="border-subtle rounded-card mt-5 flex min-h-40 items-center gap-4 border border-dashed p-5 sm:p-6">
          <span
            aria-hidden="true"
            className="border-subtle bg-surface/70 text-muted grid size-11 shrink-0 place-items-center rounded-full border text-xl"
          >
            <FiAward />
          </span>
          <div>
            <h3 className="font-bold">No challenge awards yet.</h3>
            <p className="text-muted mt-1 max-w-[52ch] text-sm leading-relaxed">
              Completed challenge recognition will stay connected to the exact
              work and result here.
            </p>
          </div>
        </div>
      )}
      {nextHref && (
        <Link
          className="border-strong hover:border-accent hover:text-accent mt-6 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
          href={nextHref}
        >
          Next awards
        </Link>
      )}
    </section>
  );
}
