'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ASSET_TYPES, getTypeFromMime } from '@/lib/asset-types'
import type { AssetScope, AssetType } from '@/types/scene'

function UploadContent() {
  const params = useSearchParams()
  const projectId = params.get('project')
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<AssetType | ''>('')
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState<AssetScope>(projectId ? 'project' : 'global')
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
    if (label.trim()) form.append('label', label.trim())
    form.append('scope', scope)
    if (projectId) form.append('projectId', projectId)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    if (res.ok) {
      setStatus('success')
      setMessage(`Uploaded ${json.id} as ${json.scope ?? 'global'}`)
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

  const libraryHref = projectId
    ? `/asset-library?project=${encodeURIComponent(projectId)}`
    : '/asset-library'

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link href={libraryHref} className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300">
              Asset Library
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">Upload Asset</h1>
          </div>
          {projectId && (
            <Link
              href={`/projects/${encodeURIComponent(projectId)}`}
              className="rounded-sm border border-[#444] bg-[#202020] px-3 py-1.5 text-xs text-gray-200 no-underline hover:bg-[#2a2a2a] active:translate-y-px"
            >
              Project
            </Link>
          )}
        </header>

        <form
          onSubmit={onSubmit}
          className="grid gap-4 border-y border-[#242424] py-5"
        >
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
          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="grid gap-1.5 text-xs text-gray-500">
              Availability
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as AssetScope)}
                className="rounded-sm border border-[#333] bg-[#222] px-2 py-1.5 text-sm text-gray-300"
              >
                <option value="global">All projects</option>
                {projectId && <option value="project">{projectId}</option>}
              </select>
            </label>
          </div>
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
                View Library
              </Link>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#111]" />}>
      <UploadContent />
    </Suspense>
  )
}
