import { Container } from "@/components/layout/container";

export default function PublicProfileLoading() {
  return (
    <main id="main-content" aria-busy="true" aria-label="Loading profile">
      <Container className="py-6 sm:py-10">
        <div className="mx-auto max-w-6xl animate-pulse motion-reduce:animate-none">
          <div className="dash-card rounded-card border-subtle grid min-h-72 items-center gap-6 border p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-7 lg:p-8">
            <div className="bg-surface-raised size-32 rounded-full sm:size-36" />
            <div>
              <div className="bg-surface-raised h-3 w-28 rounded-full" />
              <div className="bg-surface-raised mt-5 h-10 max-w-md rounded-full" />
              <div className="bg-surface-raised mt-4 h-4 w-40 rounded-full" />
              <div className="bg-surface-raised mt-7 h-4 max-w-xl rounded-full" />
              <div className="bg-surface-raised mt-3 h-4 max-w-lg rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
            <div className="dash-card rounded-card border-subtle min-h-64 border" />
            <div className="dash-card rounded-card border-subtle min-h-64 border" />
          </div>
        </div>
      </Container>
    </main>
  );
}
