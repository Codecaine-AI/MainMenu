'use client'

import { useMemo, useState } from 'react'
import { getTypeFromMime } from '@/lib/asset-types'
import type { AssetType } from '@/types/scene'

interface Props {
  initialFavicon: string
  initialTitle: string
  projectId: string
}

interface UploadResponse {
  file?: string
  error?: string
}

interface ProjectResponse {
  web?: {
    title?: string
    favicon?: string
  }
  error?: string
}

function assetUrl(projectId: string, logicalPath: string) {
  if (!logicalPath.startsWith('/assets/')) return null
  return `/api/projects/${encodeURIComponent(projectId)}${logicalPath}`
}

function typeFromFile(file: File): AssetType {
  const fromMime = getTypeFromMime(file.type)
  if (fromMime) return fromMime
  if (file.name.toLowerCase().endsWith('.svg')) return 'glyph'
  return 'image'
}

export function ProjectSettingsForm({ initialFavicon, initialTitle, projectId }: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [favicon, setFavicon] = useState(initialFavicon)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const previewSrc = useMemo(() => assetUrl(projectId, favicon), [favicon, projectId])

  async function uploadFavicon() {
    if (!file) return favicon.trim()

    const form = new FormData()
    form.append('file', file)
    form.append('type', typeFromFile(file))
    form.append('projectId', projectId)
    form.append('label', 'Favicon')

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = (await res.json().catch(() => ({}))) as UploadResponse
    if (!res.ok || !json.file) {
      throw new Error(json.error ?? `Favicon upload failed: ${res.status}`)
    }
    setFavicon(json.file)
    return json.file
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('submitting')
    setMessage('')

    try {
      const faviconPath = await uploadFavicon()
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          web: {
            title: title.trim(),
            favicon: faviconPath.trim(),
          },
        }),
      })
      const json = (await res.json().catch(() => ({}))) as ProjectResponse
      if (!res.ok) {
        throw new Error(json.error ?? `Settings save failed: ${res.status}`)
      }
      setTitle(json.web?.title ?? '')
      setFavicon(json.web?.favicon ?? '')
      setFile(null)
      window.dispatchEvent(new CustomEvent('scene-engine:project-settings-saved', {
        detail: { projectId, project: json },
      }))
      setStatus('success')
      setMessage('Saved website settings.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Settings could not be saved.')
    }
  }

  const messageClass =
    status === 'error'
      ? 'text-[#ffb4a8]'
      : status === 'success'
        ? 'text-[#bfe6b5]'
        : 'text-gray-600'

  return (
    <form className="grid gap-5 border-y border-[#242424] py-5" onSubmit={onSubmit}>
      <label className="grid gap-1.5 text-xs font-medium text-gray-400">
        Browser title
        <input
          className="min-h-8 rounded-sm border border-[#333] bg-[#202020] px-2.5 py-1 text-sm text-gray-100 outline-none transition focus:border-[#5d9bd7]"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Main Menu"
          type="text"
          value={title}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)]">
        <div className="grid h-[72px] w-[72px] place-items-center rounded-sm border border-[#454a50] bg-[#25282c]">
          {previewSrc ? (
            <img
              alt=""
              className="max-h-10 max-w-10 object-contain"
              src={previewSrc}
            />
          ) : (
            <span className="font-mono text-[10px] uppercase text-gray-600">Icon</span>
          )}
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-gray-400">
            Favicon asset path
            <input
              className="min-h-8 rounded-sm border border-[#333] bg-[#202020] px-2.5 py-1 font-mono text-xs text-gray-100 outline-none transition focus:border-[#5d9bd7]"
              onChange={(event) => setFavicon(event.target.value)}
              placeholder="/assets/image/favicon.png"
              type="text"
              value={favicon}
            />
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-gray-400">
            Upload favicon
            <input
              accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              className="min-h-8 rounded-sm border border-[#333] bg-[#202020] px-2.5 py-1 text-sm text-gray-100 file:mr-3 file:rounded-sm file:border-0 file:bg-[#3b3f44] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-100"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#242424] pt-4">
        <p aria-live="polite" className={`m-0 min-h-4 text-xs ${messageClass}`}>
          {message}
        </p>
        <button
          className="min-h-8 min-w-[88px] rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1 text-xs font-semibold text-[#cfe6ff] transition hover:bg-[#1d3d54] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          disabled={status === 'submitting'}
          type="submit"
        >
          {status === 'submitting' ? 'Saving' : 'Save'}
        </button>
      </div>
    </form>
  )
}
