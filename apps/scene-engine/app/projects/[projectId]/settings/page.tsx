import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadProject } from '@/lib/scenes'
import { ProjectSettingsForm } from './ProjectSettingsForm'

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 border-b border-[#2a2a2a] pb-5">
          <Link
            href={`/projects/${encodeURIComponent(projectId)}`}
            className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300"
          >
            {project.name ?? projectId}
          </Link>
          <h1 className="text-2xl font-semibold tracking-wide text-gray-100">
            Settings
          </h1>
          <p className="mt-1 font-mono text-xs text-gray-600">
            Website globals
          </p>
        </header>

        <section>
          <div className="mb-3">
            <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Website
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Exported page metadata shared by every scene.
            </p>
          </div>
          <ProjectSettingsForm
            initialFavicon={project.web?.favicon ?? ''}
            initialTitle={project.web?.title ?? project.name ?? ''}
            projectId={projectId}
          />
        </section>
      </div>
    </main>
  )
}
