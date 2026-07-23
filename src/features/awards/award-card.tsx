import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import type { PublicProfileAward } from "./contract";
import { getCatalogPresentation } from "./catalog-presentation";

export function awardBasisText(award: PublicProfileAward) {
  if (award.awardBasis === "community_favorite")
    return "Highest final community vote total";
  if (award.awardBasis === "official_winner")
    return `Official winner · ${award.placementLabel}`;
  return `Official placement #${award.place} · ${award.placementLabel}`;
}

export function AwardCard({ award }: { award: PublicProfileAward }) {
  const presentation = getCatalogPresentation(award.presentationCode);
  if (!presentation) return null;
  const { Icon } = presentation;
  const basis = awardBasisText(award);
  const headingId = `award-${award.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className={`${presentation.frameClassName} dash-card rounded-card relative flex h-full flex-col overflow-hidden border p-5 sm:p-6`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`${presentation.iconClassName} border-subtle bg-surface/80 flex size-12 shrink-0 items-center justify-center rounded-full border text-xl`}
        >
          <Icon />
        </span>
        <div className="min-w-0">
          <p className="text-muted font-mono text-[11px] tracking-[0.16em] uppercase">
            Challenge award
          </p>
          <h3
            id={headingId}
            className="mt-1 text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl"
          >
            {award.badgeName}
          </h3>
        </div>
      </div>
      <p className="text-accent mt-5 font-semibold">{basis}</p>
      <p className="text-ink/90 mt-3 leading-relaxed">{award.earnedMessage}</p>
      <p className="text-muted border-subtle mt-5 border-t pt-4 text-sm leading-relaxed">
        {award.challengeTitle} · {award.projectTitle}, revision{" "}
        {award.revisionNumber}
      </p>
      <time
        className="text-muted mt-2 block text-sm"
        dateTime={award.awardedAt}
      >
        Awarded {new Date(award.awardedAt).toLocaleDateString()}
      </time>
      <Link
        href={award.challengeHref}
        aria-label={`${award.badgeName} for ${award.challengeTitle}: ${basis}`}
        className="border-strong hover:border-accent-2 hover:text-accent-2 mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 font-semibold transition-colors"
      >
        View permanent result
        <FiArrowUpRight aria-hidden="true" />
      </Link>
    </article>
  );
}
