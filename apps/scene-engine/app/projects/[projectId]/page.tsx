import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoverScenes, loadProject } from '@/lib/scenes'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  const scenes = discoverScenes(projectId)

  return (
    <div className="min-h-screen bg-[#111] p-8">
      <div className="mb-6 flex max-w-xl items-center justify-between">
        <div>
          <Link href="/" className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300">
            Projects
          </Link>
          <h1 className="text-lg font-semibold tracking-wide text-gray-300">
            {project?.name ?? projectId}
          </h1>
          <p className="mt-0.5 font-mono text-xs text-gray-600">{projectId}</p>
        </div>
        <Link
          href="/upload"
          className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54]"
        >
          Upload Asset
        </Link>
      </div>

      {scenes.length === 0 ? (
        <p className="text-sm text-gray-500">
          No scenes found. Create a scene under <code className="text-gray-400">projects/{projectId}/scenes/</code> and register it in <code className="text-gray-400">project.json</code>.
        </p>
      ) : (
        <div className="grid max-w-xl gap-3">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className="flex items-center justify-between rounded border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-gray-300">{scene.name}</p>
                <p className="mt-0.5 font-mono text-xs text-gray-600">
                  {scene.id} &middot; {scene.objectCount} object{scene.objectCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scene.isEntry && (
                  <span className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#cfe6ff]">
                    Entry
                  </span>
                )}
                <Link
                  href={`/scenes/${encodeURIComponent(scene.id)}?project=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent(`/projects/${projectId}`)}`}
                  className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-300 no-underline hover:bg-[#2a2a2a]"
                >
                  Preview
                </Link>
                <Link
                  href={`/editor?project=${encodeURIComponent(projectId)}&scene=${encodeURIComponent(scene.id)}`}
                  className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54]"
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
