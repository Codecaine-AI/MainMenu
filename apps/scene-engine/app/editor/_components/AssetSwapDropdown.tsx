'use client'

import { useEffect, useMemo, useState } from 'react'
import type { AssetLibraryRecord, AssetType } from '@/types/scene'

interface Props {
  assetId: string
  assetType: AssetType
  projectId?: string | null
  onSelect: (assetId: string) => void
}

export function AssetSwapDropdown({ assetId, assetType, projectId, onSelect }: Props) {
  const [assets, setAssets] = useState<AssetLibraryRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ type: assetType, usage: '0' })
    if (projectId) params.set('project', projectId)
    setAssets(null)
    setError(null)
    fetch(`/api/asset-library?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Asset library failed: ${r.status}`)
        return r.json()
      })
      .then((j) => {
        if (!cancelled) setAssets(Array.isArray(j.assets) ? j.assets : [])
      })
      .catch((err) => {
        if (!cancelled) {
          setAssets([])
          setError(err instanceof Error ? err.message : 'Asset library failed')
        }
      })
    return () => {
      cancelled = true
    }
  }, [assetType, projectId])

  const currentAsset = useMemo(
    () => assets?.find((asset) => asset.id === assetId) ?? null,
    [assets, assetId],
  )
  const currentInList = assets?.some((asset) => asset.id === assetId) ?? false

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextAssetId = e.target.value
    if (nextAssetId === assetId) return
    onSelect(nextAssetId)
  }

  return (
    <div className="min-w-0">
      <select
        value={assetId}
        onChange={onChange}
        disabled={assets === null}
        className="w-full rounded-sm border border-[#2a2a2a] bg-[#0e0e0e] px-1 py-0.5 font-mono text-xs text-gray-300"
      >
        {assets === null ? (
          <option value={assetId}>Loading...</option>
        ) : (
          <>
            {!currentInList && <option value={assetId}>{assetId}</option>}
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.label}
              </option>
            ))}
          </>
        )}
      </select>
      <div className="mt-1 truncate font-mono text-[10px] text-gray-600">
        {currentAsset?.file ?? assetId}
      </div>
      {error && (
        <span className="mt-1 block text-[10px] text-red-400">{error}</span>
      )}
    </div>
  )
}
