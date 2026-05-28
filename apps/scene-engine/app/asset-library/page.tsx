import Link from 'next/link'
import { ASSET_TYPES, isAssetType } from '@/lib/asset-types'
import { listAssetLibrary } from '@/lib/asset-library'
import type { AssetType } from '@/types/scene'

function scopeLabel(scope: string | undefined, projectIds: string[] | undefined) {
  if (scope === 'project' && projectIds?.length) return projectIds.join(', ')
  return 'All projects'
}

export default async function AssetLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; project?: string }>
}) {
  const params = await searchParams
  const selectedType: AssetType | null = params.type && isAssetType(params.type) ? params.type : null
  const assets = listAssetLibrary({
    type: selectedType,
    projectId: params.project,
    includeUsage: true,
  })

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link href="/" className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300">
              Workspace
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">Asset Library</h1>
          </div>
          <Link
            href={params.project ? `/upload?project=${encodeURIComponent(params.project)}` : '/upload'}
            className="rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1.5 text-xs text-[#cfe6ff] no-underline hover:bg-[#1d3d54] active:translate-y-px"
          >
            Upload Asset
          </Link>
        </header>

        <nav className="mb-5 flex flex-wrap gap-2">
          <Link
            href={params.project ? `/asset-library?project=${encodeURIComponent(params.project)}` : '/asset-library'}
            className={`rounded-sm border px-2.5 py-1 text-xs no-underline ${
              selectedType
                ? 'border-[#333] bg-[#1d1d1d] text-gray-400 hover:bg-[#252525]'
                : 'border-[#2a6da3] bg-[#173247] text-[#cfe6ff]'
            }`}
          >
            All
          </Link>
          {ASSET_TYPES.map((type) => (
            <Link
              key={type}
              href={`/asset-library?${new URLSearchParams({
                ...(params.project ? { project: params.project } : {}),
                type,
              }).toString()}`}
              className={`rounded-sm border px-2.5 py-1 text-xs no-underline ${
                selectedType === type
                  ? 'border-[#2a6da3] bg-[#173247] text-[#cfe6ff]'
                  : 'border-[#333] bg-[#1d1d1d] text-gray-400 hover:bg-[#252525]'
              }`}
            >
              {type}
            </Link>
          ))}
        </nav>

        {assets.length === 0 ? (
          <div className="border-y border-[#242424] py-8 text-sm text-gray-500">
            No assets match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto border-y border-[#242424]">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] font-mono text-[11px] uppercase tracking-wide text-gray-600">
                  <th className="py-2 pr-4 font-medium">Asset</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">File</th>
                  <th className="py-2 pr-4 font-medium">Availability</th>
                  <th className="py-2 pr-4 font-medium">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="py-3 pr-4 align-top">
                      <p className="m-0 font-medium text-gray-100">{asset.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-gray-600">{asset.id}</p>
                    </td>
                    <td className="py-3 pr-4 align-top font-mono text-xs text-gray-400">{asset.type}</td>
                    <td className="max-w-[360px] py-3 pr-4 align-top font-mono text-xs text-gray-500">
                      <span className="block truncate">{asset.file}</span>
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-gray-400">
                      {scopeLabel(asset.scope, asset.projectIds)}
                    </td>
                    <td className="py-3 pr-4 align-top text-xs text-gray-400">
                      {(asset.usageCount ?? 0) > 0 ? `${asset.usageCount} reference${asset.usageCount === 1 ? '' : 's'}` : 'Unused'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
