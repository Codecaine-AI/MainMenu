'use client'

import { useMemo, useState } from 'react'
import {
  ADDABLE_OBJECT_TYPES,
  type AddableObjectType,
  createGroupObject,
  createObjectFromAsset,
  createTextObject,
  getAssetsForAddableType,
} from '@/lib/create-scene-object'
import type { Registry, SceneJson } from '@/types/scene'

interface Props {
  scene: SceneJson
  registry: Registry | null
  parentPath: string
  insertIndex: number
  onAdd: (object: Record<string, unknown>, parentPath: string, insertIndex: number) => void
  onClose: () => void
}

function pathLabel(path: string): string {
  return path === '' ? 'Top level' : 'Group children'
}

export function AddLayerDialog({ scene, registry, parentPath, insertIndex, onAdd, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<AddableObjectType | null>(null)

  const assets = useMemo(() => {
    if (!registry || !selectedType) return []
    return getAssetsForAddableType(registry, selectedType)
  }, [registry, selectedType])

  function addGroup() {
    onAdd(createGroupObject(scene), parentPath, insertIndex)
  }

  function addText() {
    onAdd(createTextObject(scene), parentPath, insertIndex)
  }

  function addAsset(assetId: string) {
    if (!registry) return
    const entry = registry[assetId]
    if (!entry) return
    onAdd(createObjectFromAsset(assetId, entry, scene), parentPath, insertIndex)
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/55" onMouseDown={onClose}>
      <div
        className="w-[420px] max-w-[calc(100vw-32px)] bg-[#171717] border border-[#333] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2b2b2b] px-3 py-2">
          <div>
            <h3 className="m-0 text-xs font-semibold text-gray-200">Add layer</h3>
            <p className="m-0 mt-0.5 text-[10px] font-mono text-gray-600">{pathLabel(parentPath)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-6 w-6 border border-[#333] bg-[#202020] text-gray-400 hover:text-gray-200 active:translate-y-px"
            aria-label="Close add layer dialog"
          >
            x
          </button>
        </div>

        <div className="grid grid-cols-[150px_1fr] min-h-[260px]">
          <div className="border-r border-[#2b2b2b] p-2">
            {ADDABLE_OBJECT_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  if (type === 'group') addGroup()
                  else if (type === 'text') addText()
                  else setSelectedType(type)
                }}
                className={`mb-1 block w-full border px-2 py-1.5 text-left text-xs active:translate-y-px ${
                  selectedType === type
                    ? 'border-[#3d6f91] bg-[#1d3247] text-gray-100'
                    : 'border-transparent bg-transparent text-gray-400 hover:bg-[#222] hover:text-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-2">
            {!selectedType ? (
              <p className="m-0 p-2 text-xs text-gray-600">Choose a layer type.</p>
            ) : !registry ? (
              <p className="m-0 p-2 text-xs italic text-gray-600">Loading registry...</p>
            ) : assets.length === 0 ? (
              <p className="m-0 p-2 text-xs text-gray-600">No assets available for this type.</p>
            ) : (
              <ul className="m-0 max-h-[300px] list-none overflow-auto p-0 text-[11px] font-mono">
                {assets.map(({ id, path }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => addAsset(id)}
                      className="flex w-full min-w-0 gap-2 px-2 py-1 text-left hover:bg-[#222] active:translate-y-px"
                    >
                      <span className="shrink-0 text-gray-300">{id}</span>
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap text-gray-600">{path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
