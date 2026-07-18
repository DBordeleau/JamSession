import Link from "next/link";
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
      className={`${presentation.frameClassName} rounded-card border p-5 shadow-[0_16px_40px_-28px_#000]`}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`${presentation.iconClassName} border-subtle bg-surface flex size-11 shrink-0 items-center justify-center rounded-full border text-xl`}
        >
          <Icon />
        </span>
        <div className="min-w-0">
          <p className="text-muted font-mono text-[11px] tracking-[0.16em] uppercase">
            Challenge award
          </p>
          <h3 id={headingId} className="mt-1 text-xl font-bold">
            {award.badgeName}
          </h3>
          <p className="text-accent mt-2 font-semibold">{basis}</p>
        </div>
      </div>
      <p className="mt-4">{award.earnedMessage}</p>
      <p className="text-muted mt-3 text-sm">
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
        className="border-strong hover:border-accent-2 hover:text-accent-2 mt-5 inline-flex min-h-11 items-center rounded-full border px-5 font-semibold transition-colors"
      >
        View permanent result
      </Link>
    </article>
  );
}
