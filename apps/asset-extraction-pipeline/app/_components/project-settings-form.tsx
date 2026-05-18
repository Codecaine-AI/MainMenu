'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ProjectSettingsFormProps {
  project: {
    id: string
    name: string
    createdAt: string
    updatedAt: string
  }
}

export function ProjectSettingsForm({ project }: ProjectSettingsFormProps) {
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isDirty = name.trim() !== project.name

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSaved(false)

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const payload = (await response.json()) as { name?: string; error?: string }
      if (!response.ok || !payload.name) {
        throw new Error(payload.error ?? 'Project update failed.')
      }
      setName(payload.name)
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project update failed.')
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
          onChange={(event) => {
            setName(event.target.value)
            setSaved(false)
          }}
        />
        <p className="help">Renaming keeps the project id and screen paths stable.</p>
      </div>
      <div className="project-facts">
        <div>
          <span className="meta">ID</span>
          <p>{project.id}</p>
        </div>
        <div>
          <span className="meta">Created</span>
          <p>{formatDate(project.createdAt)}</p>
        </div>
        <div>
          <span className="meta">Updated</span>
          <p>{formatDate(project.updatedAt)}</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {saved ? <p className="success">Project saved.</p> : null}
      <button className="button primary" disabled={pending || !name.trim() || !isDirty} type="submit">
        {pending ? 'Saving...' : 'Save Project'}
      </button>
    </form>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
