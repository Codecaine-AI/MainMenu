'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ASSET_TYPES, getTypeFromMime } from '@/lib/asset-types'
import type { AssetType } from '@/types/scene'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<AssetType | ''>('')
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
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setStatus('success')
      setMessage(`Uploaded ${json.id} → ${json.file}`)
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

  return (
    <div className="min-h-screen bg-[#111] p-8 text-gray-300">
      <div className="flex items-center justify-between max-w-xl">
        <h1 className="text-lg font-semibold text-gray-300 tracking-wide">Upload Asset</h1>
        <Link
          href="/"
          className="text-xs text-gray-500 hover:text-gray-300 no-underline"
        >
          &larr; back to dashboard
        </Link>
      </div>
      <form
        onSubmit={onSubmit}
        className="max-w-xl mt-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded p-4 flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          File
          <input
            type="file"
            onChange={onFileChange}
            className="text-sm text-gray-300"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AssetType)}
            className="text-sm bg-[#222] border border-[#333] text-gray-300 rounded-sm px-2 py-1"
          >
            <option value="" disabled>
              Select type&hellip;
            </option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <div className={`text-xs min-h-[1rem] ${messageClass}`}>{message}</div>
        <button
          type="submit"
          disabled={!file || !type || status === 'submitting'}
          className="self-start text-xs px-2.5 py-1 rounded-sm bg-[#173247] border border-[#2a6da3] text-[#cfe6ff] hover:bg-[#1d3d54] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </div>
  )
}
