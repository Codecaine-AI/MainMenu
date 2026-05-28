import Link from 'next/link'
import { notFound } from 'next/navigation'
import { projectAssetUsage } from '@/lib/asset-library'
import { discoverScenes, loadProject } from '@/lib/scenes'
import { ProjectExportButton } from './ProjectExportButton'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  const scenes = discoverScenes(projectId)
  const usedAssets = projectAssetUsage(projectId)

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
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
          <div className="flex flex-wrap items-center gap-2">
            <ProjectExportButton projectId={projectId} />
            <Link
              href={`/asset-library?project=${encodeURIComponent(projectId)}`}
              className="rounded-sm border border-[#444] bg-[#202020] px-3 py-1.5 text-xs text-gray-200 no-underline hover:bg-[#2a2a2a] active:translate-y-px"
            >
              Asset Library
            </Link>
            <Link
              href={`/upload?project=${encodeURIComponent(projectId)}`}
              className="rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1.5 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
            >
              Upload Asset
            </Link>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Scenes</h2>
            {scenes.length === 0 ? (
              <p className="text-sm text-gray-500">
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

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Asset Usage</h2>
            {usedAssets.length === 0 ? (
              <div className="border-y border-[#242424] py-6 text-sm text-gray-500">
                No asset references found.
              </div>
            ) : (
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                {usedAssets.map((asset) => (
                  <div key={asset.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-medium text-gray-100">{asset.label}</p>
                        <p className="mt-0.5 font-mono text-xs text-gray-600">{asset.id}</p>
                      </div>
                      <span className="shrink-0 font-mono text-xs text-gray-500">
                        {asset.usageCount}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-gray-600">{asset.file}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
