'use client'

import { useMemo, useCallback } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { Registry } from '@/types/scene'
import { ASSET_TYPES } from '@/lib/asset-types'

const TYPE_ORDER = ASSET_TYPES

export function AssetBrowserPanel() {
  const registry = useEditorStore((s) => s.registry)

  const groups = useMemo(() => {
    if (!registry) return []
    const byType = new Map<string, { id: string; path: string }[]>()
    for (const [id, entry] of Object.entries(registry as Registry)) {
      const type = entry.type
      if (!byType.has(type)) byType.set(type, [])
      byType.get(type)!.push({ id, path: 'file' in entry ? entry.file : entry.path })
    }
    return TYPE_ORDER.filter((t) => byType.has(t)).map((t) => ({
      type: t,
      entries: byType.get(t)!,
    }))
  }, [registry])

  const handleDragStart = useCallback((e: React.DragEvent, assetId: string) => {
    const entry = (registry as Registry | null)?.[assetId]
    if (entry?.type === 'font') {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/x-asset-id', assetId)
    e.dataTransfer.setData('text/plain', assetId)
    e.dataTransfer.effectAllowed = 'copy'
  }, [registry])

  return (
    <section className="bg-[#161616] overflow-auto p-2" style={{ gridArea: 'asset' }}>
      <h3 className="text-[13px] uppercase tracking-wide text-gray-100 font-bold mb-2">Assets</h3>
      {!registry ? (
        <p className="text-gray-600 text-xs italic">Loading registry...</p>
      ) : (
        <div className="flex gap-4 items-start flex-wrap">
          {groups.map(({ type, entries }) => (
            <div key={type} className="min-w-[200px] shrink-0">
              <h4 className="m-0 mb-1.5 text-[12px] font-bold text-gray-200 capitalize">
                {type}
              </h4>
              <ul className="list-none p-0 m-0 text-[11px] font-mono">
                {entries.map(({ id, path }) => (
                  <li
                    key={id}
                    className="flex gap-2 py-0.5 px-1 cursor-default select-none hover:bg-[#222]"
                    draggable={type !== 'font'}
                    onDragStart={(e) => handleDragStart(e, id)}
                  >
                    <span className="text-gray-100 shrink-0">{id}</span>
                    <span className="text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap">{path}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
