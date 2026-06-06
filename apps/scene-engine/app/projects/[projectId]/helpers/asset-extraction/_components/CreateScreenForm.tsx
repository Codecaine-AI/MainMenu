'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CreateScreenForm({ projectId }: { projectId: string }) {
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
      form.set('name', name)
      form.set('source', file)
      const response = await fetch(`/api/projects/${projectId}/helpers/asset-extraction/screens`, {
        method: 'POST',
        body: form,
      })
      const payload = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? 'Screen creation failed.')
      }
      router.push(`/projects/${projectId}/screen-breakdown/screens/${payload.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screen creation failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor="screen-name">
          Screen name
        </label>
        <input
          id="screen-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Main Menu 1"
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="screen-source">
          Source image
        </label>
        <input
          id="screen-source"
          className="file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="help">This becomes the root node for the screen decomposition tree.</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="button primary" disabled={pending || !name.trim() || !file} type="submit">
        {pending ? 'Adding...' : 'Add Screen'}
      </button>
    </form>
  )
}
