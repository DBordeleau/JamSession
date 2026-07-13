import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { projectIdSchema } from "@/features/projects/schema";
import { StudioLauncher } from "@/features/studio/components/studio-launcher.client";
import { getProjectForViewer } from "@/server/repositories/projects";
import { getRevisionPlayback } from "@/server/repositories/revisions";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  await requireViewer(`/projects/${projectId}/studio`);
  const project = await getProjectForViewer(projectId);
  if (!project) notFound();
  const revision = project.currentRevisionId
    ? await getRevisionPlayback({
        projectId,
        revisionId: project.currentRevisionId,
      })
    : null;
  return (
    <main id="main-content">
      <Container className="py-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <Link
              className="text-accent underline"
              href={`/projects/${projectId}`}
            >
              Return to project
            </Link>
            <p className="text-accent mt-6 text-sm font-semibold tracking-widest uppercase">
              Current revision {revision?.revisionNumber ?? "—"}
            </p>
            <h1 className="mt-2 text-4xl font-bold">{project.title} studio</h1>
            <p className="text-muted mt-3">
              Read-only synchronized playback of the immutable published
              arrangement.
            </p>
          </div>
          {revision ? (
            <StudioLauncher
              projectId={projectId}
              revisionId={revision.revisionId}
              manifest={revision.manifest}
              durationMs={revision.durationMs}
              tracks={revision.tracks.map(
                ({ trackId, instrumentName, creditName }) => ({
                  trackId,
                  instrumentName,
                  creditName,
                }),
              )}
            />
          ) : (
            <section className="rounded-card border-strong border border-dashed p-8">
              <h2 className="text-xl font-bold">No published revision yet</h2>
              <p className="text-muted mt-2">
                Publish an arrangement before opening the studio.
              </p>
            </section>
          )}
        </div>
      </Container>
    </main>
  );
}
