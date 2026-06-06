'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ASSET_TYPES, getTypeFromMime } from '@/lib/asset-types'
import type { AssetType } from '@/types/scene'

interface Props {
  projectId: string
}

export function ProjectAssetUploadForm({ projectId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<AssetType | ''>('')
  const [label, setLabel] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setStatus('idle')
    setMessage('')
    if (f) {
      const suggested = getTypeFromMime(f.type)
      if (suggested) setType(suggested)
      if (!label) setLabel(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !type) return
    setStatus('submitting')
    setMessage('')
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    form.append('projectId', projectId)
    if (label.trim()) form.append('label', label.trim())

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setStatus('success')
      setMessage(`Uploaded ${json.id} to ${projectId}`)
    } else {
      setStatus('error')
      setMessage(json.error ?? 'Upload failed')
    }
  }

  const messageClass =
    status === 'error'
      ? 'text-red-400'
      : status === 'success'
        ? 'text-emerald-400'
        : 'text-gray-500'

  const libraryHref = `/projects/${encodeURIComponent(projectId)}/assets`

  return (
    <form onSubmit={onSubmit} className="grid gap-4 border-y border-[#242424] py-5">
      <label className="grid gap-1.5 text-xs text-gray-500">
        File
        <input
          type="file"
          onChange={onFileChange}
          className="rounded-sm border border-[#333] bg-[#1b1b1b] px-2 py-1.5 text-sm text-gray-300"
        />
      </label>
      <label className="grid gap-1.5 text-xs text-gray-500">
        Label
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-sm border border-[#333] bg-[#222] px-2 py-1.5 text-sm text-gray-300"
        />
      </label>
      <label className="grid gap-1.5 text-xs text-gray-500">
        Type
        <select
          value={type}
          onChange={(e) => setType(e.target.value as AssetType)}
          className="rounded-sm border border-[#333] bg-[#222] px-2 py-1.5 text-sm text-gray-300"
        >
          <option value="" disabled>
            Select type...
          </option>
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <div className={`min-h-4 text-xs ${messageClass}`}>{message}</div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={!file || !type || status === 'submitting'}
          className="rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1.5 text-xs text-[#cfe6ff] hover:bg-[#1d3d54] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'submitting' ? 'Uploading...' : 'Upload'}
        </button>
        {status === 'success' && (
          <Link href={libraryHref} className="text-xs text-gray-500 no-underline hover:text-gray-300">
            View Assets
          </Link>
        )}
      </div>
    </form>
  )
}
