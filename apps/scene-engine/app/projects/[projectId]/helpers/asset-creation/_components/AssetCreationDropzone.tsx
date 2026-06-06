'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function AssetCreationDropzone({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return

    setPending(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('source', file)
      form.set('name', name)
      const response = await fetch(`/api/projects/${projectId}/helpers/asset-creation/assets`, {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? 'Asset setup failed.')
      }
      router.push(`/projects/${projectId}/asset-workbench/assets/${payload.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Asset setup failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 border-y border-[#242424] py-5">
      <label className="grid gap-1.5 text-xs text-gray-500">
        Source image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null
            setFile(nextFile)
            if (nextFile && !name.trim()) {
              setName(nextFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
            }
          }}
          className="rounded-sm border border-[#333] bg-[#1b1b1b] px-2 py-1.5 text-sm text-gray-300"
        />
      </label>
      <label className="grid gap-1.5 text-xs text-gray-500">
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-sm border border-[#333] bg-[#222] px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-[#5d7790]"
        />
      </label>
      {error ? <p className="m-0 text-xs text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={!file || pending}
        className="rounded-sm border border-[#2a6da3] bg-[#173247] px-3 py-1.5 text-xs font-medium text-[#cfe6ff] hover:bg-[#1d3d54] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Creating...' : 'Create Asset'}
      </button>
    </form>
  )
}
