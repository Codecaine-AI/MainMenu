import Link from 'next/link'
import { notFound } from 'next/navigation'
import { loadAssetCreation } from '@/features/asset-creation/store'
import { ComponentCodeEditor } from '../../../helpers/asset-creation/_components/ComponentCodeEditor'

export default async function AssetWorkbenchItemPage({
  params,
}: {
  params: Promise<{ projectId: string; assetId: string }>
}) {
  const { projectId, assetId } = await params
  const record = await loadAssetCreation(projectId, assetId)
  if (!record) notFound()

  const base = `/api/projects/${projectId}/helpers/asset-creation/assets/${assetId}`
  const sourceUrl = `${base}/source?v=${encodeURIComponent(record.updatedAt)}`
  const renderUrl = record.renderImage
    ? `${base}/render?v=${encodeURIComponent(record.updatedAt)}`
    : null

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/asset-workbench`}
              className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300"
            >
              Asset Workbench
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">{record.name}</h1>
            <p className="mt-1 font-mono text-xs text-gray-600">{record.id}</p>
          </div>
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/assets`}
            className="rounded-sm border border-[#444] bg-[#202020] px-3 py-1.5 text-xs text-gray-200 no-underline hover:bg-[#2a2a2a] active:translate-y-px"
          >
            Assets
          </Link>
        </header>

        <ComponentCodeEditor initialRecord={record} sourceUrl={sourceUrl} renderUrl={renderUrl} />
      </div>
    </main>
  )
}
