'use client'

import { useState } from 'react'

interface Props {
  projectId: string
}

export function ProjectExportButton({ projectId }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/export?project=${encodeURIComponent(projectId)}`, { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Export failed: ${res.status} ${text}`)
      }
      const blob = await res.blob()
      const header = res.headers.get('Content-Disposition')
      const match = header?.match(/filename="?([^"]+)"?/i)
      const filename = match ? match[1] : `${projectId}.zip`
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
    <button
      type="button"
      onClick={handleExport}
      disabled={exporting}
      className="rounded-sm border border-[#3d3d3d] bg-[#222] px-2.5 py-1 text-xs text-gray-300 hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {exporting ? 'Exporting...' : 'Export Project'}
    </button>
  )
}
