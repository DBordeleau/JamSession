import { BootstrapReveal } from "./_components/bootstrap-reveal";

const concepts = [
  {
    eyebrow: "Projects",
    title: "Build songs from stems",
    description:
      "Create a shared musical starting point with clear metadata and attribution.",
  },
  {
    eyebrow: "Contributions",
    title: "Propose a new direction",
    description:
      "Submit stems and arrangement changes for the project owner to review.",
  },
  {
    eyebrow: "Forks",
    title: "Remix without losing history",
    description:
      "Explore an independent version while preserving its lineage and credits.",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 sm:py-12 lg:px-14">
      <nav aria-label="Primary" className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-[0.24em] text-[var(--accent)] uppercase">
          Jam Session
        </span>
        <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]">
          MVP in development
        </span>
      </nav>

      <BootstrapReveal>
        <section className="py-20 sm:py-28" aria-labelledby="page-title">
          <p className="mb-5 text-sm font-medium text-[var(--accent)]">
            Project foundation initialized
          </p>
          <h1
            id="page-title"
            className="max-w-4xl text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-balance sm:text-7xl lg:text-8xl"
          >
            Make music like open source.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-[var(--muted)] sm:text-xl">
            Jam Session is an asynchronous collaboration space where musicians
            can share stems, propose changes, and fork songs into new creative
            directions.
          </p>
        </section>
      </BootstrapReveal>

      <section
        aria-label="Core collaboration concepts"
        className="grid gap-4 pb-5 md:grid-cols-3"
      >
        {concepts.map((concept) => (
          <article
            key={concept.eyebrow}
            className="rounded-2xl border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] p-6"
          >
            <p className="text-xs font-semibold tracking-[0.18em] text-[var(--accent)] uppercase">
              {concept.eyebrow}
            </p>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              {concept.title}
            </h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              {concept.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
