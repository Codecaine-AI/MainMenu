'use client'

import { useState } from 'react'
import { useEditorStore } from '@/store/editor-store'

interface Props {
  sceneId: string
  onReload: () => void
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename="?([^"]+)"?/i)
  return match ? match[1] : null
}

export function EditorToolbar({ sceneId, onReload }: Props) {
  const dirty = useEditorStore((s) => s.dirty)
  const scene = useEditorStore((s) => s.scene)
  const markClean = useEditorStore((s) => s.markClean)
  const [exporting, setExporting] = useState(false)

  async function handleSave() {
    if (!scene) return
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scene),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      markClean()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    }
  }

  function handleReload() {
    if (dirty && !window.confirm('You have unsaved changes. Discard and reload?')) return
    onReload()
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/export', { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Export failed: ${res.status} ${text}`)
      }
      const blob = await res.blob()
      const filename =
        parseContentDisposition(res.headers.get('Content-Disposition')) ?? 'project.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="flex items-center justify-between h-9 bg-[#161616] border-b border-[#2a2a2a] px-3 gap-3 text-xs font-sans">
      <div className="flex items-center gap-2.5">
        <span className="text-gray-300 tracking-wide">Scene Engine</span>
        <span className="text-gray-500">Scene: {sceneId}</span>
        <span
          className={`w-2 h-2 rounded-full inline-block border ${
            dirty
              ? 'bg-[#ffd84d] border-[#ffd84d] shadow-[0_0_0_2px_rgba(255,216,77,0.18)]'
              : 'bg-transparent border-[#444]'
          }`}
        />
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleReload}
          className="bg-[#222] text-gray-300 border border-[#333] px-2.5 py-1 rounded-sm text-xs cursor-pointer hover:bg-[#2a2a2a]"
        >
          Reload
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="bg-[#222] text-gray-300 border border-[#333] px-2.5 py-1 rounded-sm text-xs cursor-pointer hover:bg-[#2a2a2a] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting ? 'Exporting...' : 'Export'}
        </button>
        <button
          onClick={handleSave}
          disabled={!dirty}
          className={`px-2.5 py-1 rounded-sm text-xs border cursor-pointer ${
            dirty
              ? 'bg-[#173247] text-[#cfe6ff] border-[#2a6da3] hover:bg-[#1d3d54]'
              : 'bg-[#222] text-gray-300 border-[#333] opacity-40 cursor-not-allowed'
          }`}
        >
          Save
        </button>
      </div>
    </header>
  )
}
