import { Container } from "@/components/layout/container";
export default function LibraryLoading() {
  return (
    <main id="main-content">
      <Container className="py-16" aria-busy="true">
        <p className="text-accent-2 font-mono text-xs tracking-[.2em] uppercase">
          MIDI library
        </p>
        <h1 className="mt-4 text-4xl font-bold">Tuning the catalog…</h1>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="rounded-card border-subtle bg-surface-raised h-80 animate-pulse border"
            />
          ))}
        </div>
      </Container>
    </main>
  );
}
