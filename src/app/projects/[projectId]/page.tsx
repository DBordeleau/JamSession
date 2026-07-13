import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { getProjectForViewer } from "@/server/repositories/projects";
export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { projectId } = await params;
  await requireViewer(`/projects/${projectId}`);
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const saved = (await searchParams).saved === "1";
  return (
    <main id="main-content">
      <Container className="py-16">
        <article className="mx-auto max-w-3xl">
          {saved && (
            <p
              role="status"
              className="rounded-control border-accent mb-6 border p-3"
            >
              Project saved.
            </p>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-accent font-semibold">Private · Draft</p>
              <h1 className="mt-2 text-4xl font-bold">{project.title}</h1>
            </div>
            <Link
              className="rounded-control border-strong min-h-11 border px-4 py-2"
              href={`/projects/${project.id}/edit`}
            >
              Edit metadata
            </Link>
          </div>
          {project.description && (
            <p className="text-muted mt-6 whitespace-pre-wrap">
              {project.description}
            </p>
          )}
          <dl className="rounded-card border-subtle bg-surface mt-8 grid gap-5 border p-6 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Tempo</dt>
              <dd>{project.bpm ? `${project.bpm} BPM` : "Not set"}</dd>
            </div>
            <div>
              <dt className="text-muted">Key / signature</dt>
              <dd>
                {project.musicalKey ?? "Not set"} ·{" "}
                {project.timeSignature.numerator}/
                {project.timeSignature.denominator}
              </dd>
            </div>
            <div>
              <dt className="text-muted">License</dt>
              <dd>
                <a className="underline" href={project.license.url}>
                  {project.license.name}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-muted">Genres</dt>
              <dd>
                {project.genres
                  .map((g) => `${g.name}${g.isPrimary ? " (primary)" : ""}`)
                  .join(", ") || "None"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Tags</dt>
              <dd>{project.tags.map((t) => t.name).join(", ") || "None"}</dd>
            </div>
          </dl>
          <section className="rounded-card border-strong mt-8 border border-dashed p-8 text-center">
            <h2 className="text-xl font-bold">No stems yet</h2>
            <p className="text-muted mt-2">
              Audio upload and the browser workspace arrive in the next project
              phase.
            </p>
          </section>
        </article>
      </Container>
    </main>
  );
}
