import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { updateProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/project-form";
import { projectIdSchema } from "@/features/projects/schema";
import {
  getProjectForViewer,
  listProjectFormOptions,
} from "@/server/repositories/projects";
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const viewer = await requireViewer(`/projects/${projectId}/edit`);
  if (!viewer.profileCompletedAt) redirect("/onboarding");
  if (!projectIdSchema.safeParse(projectId).success) notFound();
  const [project, options] = await Promise.all([
    getProjectForViewer(projectId),
    listProjectFormOptions(),
  ]);
  if (!project) notFound();
  const action = updateProjectAction.bind(
    null,
    project.id,
    project.lockVersion,
  );
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-3xl">
          <p className="text-accent font-semibold">Private draft</p>
          <h1 className="mt-2 text-4xl font-bold">Edit project</h1>
          <ProjectForm action={action} options={options} project={project} />
        </section>
      </Container>
    </main>
  );
}
