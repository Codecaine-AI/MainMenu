import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadProject } from '@/lib/scenes'
import { ProjectAssetUploadForm } from './ProjectAssetUploadForm'

export default async function ProjectAssetUploadPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/assets`}
              className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300"
            >
              Assets
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">Upload</h1>
            <p className="mt-1 font-mono text-xs text-gray-600">
              {project.name ?? projectId}
            </p>
          </div>
        </header>

        <ProjectAssetUploadForm projectId={projectId} />
      </div>
    </main>
  )
}
