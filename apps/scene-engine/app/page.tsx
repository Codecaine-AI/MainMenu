import Link from 'next/link'
import { defaultProjectId, discoverProjectsWithDiagnostics } from '@/lib/scenes'
import { listAssetLibrary } from '@/lib/asset-library'

export default function DashboardPage() {
  const { projects, diagnostics } = discoverProjectsWithDiagnostics()
  const activeProjectId = defaultProjectId()
  const assets = listAssetLibrary({ projectId: activeProjectId, includeUsage: false })
  const assetLibraryHref = activeProjectId
    ? `/asset-library?project=${encodeURIComponent(activeProjectId)}`
    : '/asset-library'
  const uploadHref = activeProjectId
    ? `/upload?project=${encodeURIComponent(activeProjectId)}`
    : '/upload'

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 border-b border-[#2a2a2a] pb-5">
          <h1 className="text-2xl font-semibold tracking-wide text-gray-100">
            Main Menu
          </h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Projects
            </h2>
            {diagnostics.length > 0 && (
              <div className="mb-4 border-y border-[#3a2f1f] py-3 text-xs text-amber-300">
                {diagnostics.map((item) => (
                  <p key={`${item.code}-${item.projectId ?? item.message}`} className="m-0 py-0.5">
                    <span className="font-mono uppercase text-amber-500">{item.level}</span> {item.message}
                  </p>
                ))}
              </div>
            )}
            {projects.length === 0 ? (
              <div className="border-y border-[#242424] py-6 text-sm text-gray-500">
                No projects found.
              </div>
            ) : (
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 truncate text-sm font-medium text-gray-100">
                          {project.name}
                        </p>
                        {project.isLegacyRoot && (
                          <span className="rounded-sm border border-[#555] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-500">
                            Legacy
                          </span>
                        )}
                        {project.layout === 'external' && (
                          <span className="rounded-sm border border-[#2a6da3] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[#8fc6f2]">
                            Catalog
                          </span>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-xs text-gray-600">
                        {project.id} / entry {project.entry}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/scenes/${encodeURIComponent(project.entry)}?project=${encodeURIComponent(project.id)}&returnTo=${encodeURIComponent('/')}`}
                        className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200 no-underline hover:bg-[#2b2b2b] active:translate-y-px"
                      >
                        Preview
                      </Link>
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}`}
                        className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
                Assets
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href={assetLibraryHref}
                  className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200 no-underline hover:bg-[#2b2b2b] active:translate-y-px"
                >
                  Library
                </Link>
                <Link
                  href={uploadHref}
                  className="rounded-sm border border-[#2a6da3] bg-[#173247] px-2.5 py-1 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
                >
                  Upload
                </Link>
              </div>
            </div>
            {assets.length === 0 ? (
              <div className="border-y border-[#242424] py-6 text-sm text-gray-500">
                No assets found.
              </div>
            ) : (
              <div className="divide-y divide-[#242424] border-y border-[#242424]">
                {assets.map((asset) => (
                  <div key={asset.id} className="py-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-medium text-gray-100">
                          {asset.label}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-gray-600">
                          {asset.id}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-sm border border-[#333] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-500">
                        {asset.type}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11px] text-gray-600">
                      {asset.file}
                    </p>
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
