'use client'

import { useEffect, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { AssetType } from '@/types/scene'

interface Props {
  assetId: string
  assetType: AssetType
  currentFile: string
}

interface FileEntry {
  name: string
  file: string
}

export function AssetSwapDropdown({ assetId, assetType, currentFile }: Props) {
  const [files, setFiles] = useState<FileEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const updateContainerFile = useEditorStore((s) => s.updateContainerFile)

  useEffect(() => {
    let cancelled = false
    setFiles(null)
    setError(null)
    fetch('/api/assets/' + assetType)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setFiles(Array.isArray(j.files) ? j.files : [])
      })
      .catch(() => {
        if (!cancelled) setFiles([])
      })
    return () => {
      cancelled = true
    }
  }, [assetType])

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newFile = e.target.value
    if (newFile === currentFile) return
    setError(null)
    const res = await fetch('/api/registry/' + assetId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: newFile }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Swap failed')
      return
    }
    await updateContainerFile(assetId, newFile)
  }

  const currentInList = files?.some((f) => f.file === currentFile) ?? false

  return (
    <>
      <dt className="text-gray-500 whitespace-nowrap">file</dt>
      <dd className="m-0 text-gray-300 break-all">
        <select
          value={currentFile}
          onChange={onChange}
          disabled={files === null}
          className="w-full bg-[#0e0e0e] border border-[#2a2a2a] text-gray-300 text-xs font-mono px-1 py-0.5 rounded-sm"
        >
          {files === null ? (
            <option value={currentFile}>Loading…</option>
          ) : (
            <>
              {!currentInList && <option value={currentFile}>{currentFile}</option>}
              {files.map((f) => (
                <option key={f.file} value={f.file}>
                  {f.name}
                </option>
              ))}
            </>
          )}
        </select>
        {error && (
          <span className="text-red-400 text-[10px] block mt-1">{error}</span>
        )}
      </dd>
    </>
  )
}
