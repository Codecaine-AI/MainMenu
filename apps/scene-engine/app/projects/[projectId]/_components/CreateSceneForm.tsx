'use client'

import type { FormEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
}

type CreateMode = 'blank' | 'image'

interface CreateResponse {
  id?: string
  error?: string
}

export function CreateSceneForm({ projectId }: Props) {
  const router = useRouter()
  const nameId = useId()
  const imageId = useId()
  const firstInputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CreateMode>('blank')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    firstInputRef.current?.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeDialog()
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, pending])

  function closeDialog() {
    if (pending) return
    setOpen(false)
    setName('')
    setFile(null)
    setMode('blank')
    setError(null)
  }

  function switchMode(nextMode: CreateMode) {
    setMode(nextMode)
    setError(null)
  }

  async function createBlankScene() {
    const res = await fetch(`/api/scenes?project=${encodeURIComponent(projectId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    const json = (await res.json().catch(() => ({}))) as CreateResponse
    if (!res.ok || !json.id) {
      throw new Error(json.error ?? `Create scene failed: ${res.status}`)
    }
    router.push(`/editor?project=${encodeURIComponent(projectId)}&scene=${encodeURIComponent(json.id)}`)
  }

  async function createImageBreakdown() {
    if (!file) throw new Error('Source image is required.')

    const form = new FormData()
    form.set('name', name.trim())
    form.set('source', file)
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/helpers/asset-extraction/screens`, {
      method: 'POST',
      body: form,
    })
    const json = (await res.json().catch(() => ({}))) as CreateResponse
    if (!res.ok || !json.id) {
      throw new Error(json.error ?? `Reference creation failed: ${res.status}`)
    }
    router.push(`/projects/${encodeURIComponent(projectId)}/screen-breakdown/screens/${encodeURIComponent(json.id)}`)
    router.refresh()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || pending) return

    setPending(true)
    setError(null)
    try {
      if (mode === 'blank') {
        await createBlankScene()
      } else {
        await createImageBreakdown()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed')
    } finally {
      setPending(false)
    }
  }

  const submitDisabled = pending || !name.trim() || (mode === 'image' && !file)

  return (
    <>
      <button
        aria-label="New scene"
        className="inline-flex min-h-8 items-center gap-2 rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1 text-xs font-semibold text-[#cfe6ff] transition hover:bg-[#1d3d54] active:translate-y-px"
        onClick={() => setOpen(true)}
        title="New scene"
        type="button"
      >
        <span className="text-base leading-none">+</span>
        <span>New Scene</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-20 grid place-items-center px-4 py-6">
          <button
            aria-label="Close new scene dialog"
            className="absolute inset-0 bg-[#17191c]/80"
            onClick={closeDialog}
            type="button"
          />
          <form
            aria-modal="true"
            className="relative grid w-full max-w-[520px] gap-4 rounded-md border border-[#454a50] bg-[#303338] p-4 text-gray-300 shadow-[0_20px_48px_rgba(0,0,0,0.36)]"
            onSubmit={handleSubmit}
            role="dialog"
          >
            <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[#454a50] pb-3">
              <div className="min-w-0">
                <p className="m-0 text-sm font-semibold text-gray-100">New Scene</p>
                <p className="mt-1 font-mono text-xs text-gray-600">{projectId}</p>
              </div>
              <button
                aria-label="Close"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-[#454a50] bg-[#2a2d31] text-sm text-gray-300 transition hover:bg-[#3b3f44] active:translate-y-px"
                onClick={closeDialog}
                type="button"
              >
                x
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-sm border border-[#454a50] bg-[#272a2e] p-1">
              <button
                className={mode === 'blank' ? 'rounded-sm bg-[#2d4154] px-3 py-2 text-xs font-semibold text-[#e5f3ff]' : 'rounded-sm px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-[#3b3f44]'}
                onClick={() => switchMode('blank')}
                type="button"
              >
                Blank
              </button>
              <button
                className={mode === 'image' ? 'rounded-sm bg-[#2d4154] px-3 py-2 text-xs font-semibold text-[#e5f3ff]' : 'rounded-sm px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-[#3b3f44]'}
                onClick={() => switchMode('image')}
                type="button"
              >
                From Image
              </button>
            </div>

            <label className="grid gap-1 text-xs font-medium text-gray-400" htmlFor={nameId}>
              {mode === 'blank' ? 'Scene name' : 'Reference name'}
              <input
                className="min-h-8 rounded-sm border border-[#333] bg-[#202020] px-2.5 py-1 text-sm text-gray-100 outline-none transition focus:border-[#5d9bd7]"
                id={nameId}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder={mode === 'blank' ? 'New scene' : 'Reference screen'}
                ref={firstInputRef}
                type="text"
                value={name}
              />
            </label>

            {mode === 'image' && (
              <label className="grid gap-1 text-xs font-medium text-gray-400" htmlFor={imageId}>
                Source image
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="min-h-8 rounded-sm border border-[#333] bg-[#202020] px-2.5 py-1 text-sm text-gray-100 file:mr-3 file:rounded-sm file:border-0 file:bg-[#3b3f44] file:px-2 file:py-1 file:text-xs file:font-semibold file:text-gray-100"
                  id={imageId}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            )}

            {error && <p aria-live="polite" className="m-0 text-xs text-[#ffb4a8]">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-[#454a50] pt-3">
              <button
                className="min-h-8 rounded-sm border border-[#454a50] bg-[#2a2d31] px-3 py-1 text-xs font-semibold text-gray-300 transition hover:bg-[#3b3f44] active:translate-y-px"
                onClick={closeDialog}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-8 min-w-[120px] rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1 text-xs font-semibold text-[#cfe6ff] transition hover:bg-[#1d3d54] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitDisabled}
                type="submit"
              >
                {pending ? 'Creating' : mode === 'blank' ? 'Create Scene' : 'Open Breakdown'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
