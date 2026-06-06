import Link from 'next/link'
import { notFound } from 'next/navigation'
import { listAssetCreations } from '@/features/asset-creation/store'
import { loadProject } from '@/lib/scenes'
import { AssetCreationDropzone } from '../helpers/asset-creation/_components/AssetCreationDropzone'

export default async function AssetWorkbenchPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  const assets = await listAssetCreations(projectId)
  const projectBase = `/projects/${encodeURIComponent(projectId)}`

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link
              href={projectBase}
              className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300"
            >
              Project
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">Asset Workbench</h1>
            <p className="mt-1 text-sm text-gray-500">
              Refine atomic visual pieces for {project.name ?? projectId}.
            </p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Atomic Assets</h2>
            {assets.length === 0 ? (
              <div className="border-y border-[#242424] py-8 text-sm text-gray-500">
                No asset workbench items yet.
              </div>
            ) : (
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                {assets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`${projectBase}/asset-workbench/assets/${asset.id}`}
                    className="grid gap-3 py-4 no-underline md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 text-sm font-medium text-gray-100">{asset.name}</p>
                        {asset.promotedAssetId ? (
                          <span className="rounded-sm border border-[#315a3f] bg-[#17281d] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-emerald-300">
                            Published
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-600">{asset.id}</p>
                    </div>
                    <span className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200">
                      Open
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">New Asset</h2>
            <AssetCreationDropzone projectId={projectId} />
          </aside>
        </div>
      </div>
    </main>
  )
}
