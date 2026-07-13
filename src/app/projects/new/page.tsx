import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { requireViewer } from "@/features/auth/guards";
import { createProjectAction } from "@/features/projects/actions";
import { ProjectForm } from "@/features/projects/project-form";
import { listProjectFormOptions } from "@/server/repositories/projects";
export default async function NewProjectPage() {
  const viewer = await requireViewer("/projects/new");
  if (!viewer.profileCompletedAt) redirect("/onboarding");
  const options = await listProjectFormOptions();
  const action = createProjectAction.bind(null, randomUUID());
  return (
    <main id="main-content">
      <Container className="py-16">
        <section className="mx-auto max-w-3xl">
          <p className="text-accent font-semibold">Private draft</p>
          <h1 className="mt-2 text-4xl font-bold">Create a project</h1>
          <p className="text-muted mt-3">
            Start with the musical context. Stems and the studio arrive in the
            next phase.
          </p>
          <ProjectForm action={action} options={options} />
        </section>
      </Container>
    </main>
  );
}
