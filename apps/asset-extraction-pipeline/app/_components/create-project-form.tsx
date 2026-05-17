'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CreateProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const payload = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !payload.id) {
        throw new Error(payload.error ?? 'Project creation failed.')
      }
      router.push(`/projects/${payload.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project creation failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="field">
        <label className="label" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Melee"
        />
        <p className="help">A project collects related screens and promoted assets.</p>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <button className="button primary" disabled={pending || !name.trim()} type="submit">
        {pending ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  )
}
