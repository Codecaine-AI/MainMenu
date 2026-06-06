import Link from 'next/link'
import { notFound } from 'next/navigation'
import { discoverScenes, loadProject } from '@/lib/scenes'
import { CreateSceneForm } from './_components/CreateSceneForm'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  const scenes = discoverScenes(projectId)
  const projectBase = `/projects/${encodeURIComponent(projectId)}`

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link href="/" className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300">
              Workspace
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">
              {project.name ?? projectId}
            </h1>
            <p className="mt-1 font-mono text-xs text-gray-600">
              {projectId} / entry {project.entry}
            </p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section>
            <div className="mb-3 grid gap-3 border-b border-[#242424] pb-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-gray-400">Scenes</h2>
                <p className="mt-1 text-xs text-gray-600">
                  Full screens in this project.
                </p>
              </div>
              <CreateSceneForm projectId={projectId} />
            </div>
            {scenes.length === 0 ? (
              <p className="border-y border-[#242424] py-5 text-sm text-gray-500">
                No scenes found in this project workspace.
              </p>
            ) : (
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                {scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-sm font-medium text-gray-100">{scene.name}</p>
                        {scene.isEntry && (
                          <span className="rounded-sm border border-[#2a6da3] bg-[#173247] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#cfe6ff]">
                            Entry
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-600">
                        {scene.id} / {scene.objectCount} object{scene.objectCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/scenes/${encodeURIComponent(scene.id)}?project=${encodeURIComponent(projectId)}&returnTo=${encodeURIComponent(`/projects/${projectId}`)}`}
                        className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200 no-underline hover:bg-[#2b2b2b] active:translate-y-px"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/editor?project=${encodeURIComponent(projectId)}&scene=${encodeURIComponent(scene.id)}`}
                        className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="grid gap-8">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Build Flow</h2>
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                <Link
                  href={`${projectBase}/screen-breakdown`}
                  className="grid gap-1 py-3 no-underline hover:bg-[#171717] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <span className="text-sm font-medium text-gray-100">Screen Breakdown</span>
                  <span className="font-mono text-xs text-gray-600">Reference to pieces</span>
                </Link>
                <Link
                  href={`${projectBase}/asset-workbench`}
                  className="grid gap-1 py-3 no-underline hover:bg-[#171717] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <span className="text-sm font-medium text-gray-100">Asset Workbench</span>
                  <span className="font-mono text-xs text-gray-600">Piece to asset</span>
                </Link>
                <Link
                  href={`${projectBase}/component-workbench`}
                  className="grid gap-1 py-3 no-underline hover:bg-[#171717] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <span className="text-sm font-medium text-gray-100">Component Workbench</span>
                  <span className="font-mono text-xs text-gray-600">Assets to UI units</span>
                </Link>
                <Link
                  href={`${projectBase}/assets`}
                  className="grid gap-1 py-3 no-underline hover:bg-[#171717] md:grid-cols-[1fr_auto] md:items-center"
                >
                  <span className="text-sm font-medium text-gray-100">Assets</span>
                  <span className="font-mono text-xs text-gray-600">Project library</span>
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
