'use client'

import { useState } from 'react'

interface Props {
  projectId: string
}

interface DeployResponse {
  ok?: boolean
  shortCommit?: string
  committed?: boolean
  pushed?: boolean
  message?: string
  error?: string
}

export function ProjectDeployButton({ projectId }: Props) {
  const [deploying, setDeploying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function handleDeploy() {
    if (!window.confirm('Commit and push the saved project workspace for deployment?')) return
    setDeploying(true)
    setStatus(null)

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => ({}))) as DeployResponse
      if (!res.ok) throw new Error(json.error ?? `Deploy failed: ${res.status}`)

      if (json.pushed && json.shortCommit) {
        setStatus(`Pushed ${json.shortCommit}`)
      } else if (json.message) {
        setStatus(json.message)
      } else {
        setStatus('Deploy complete')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deploy failed'
      setStatus(message)
      alert(message)
    } finally {
      setDeploying(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDeploy}
        disabled={deploying}
        className="rounded-sm border border-[#2c7d45] bg-[#17351f] px-2.5 py-1 text-xs text-[#d7ffe0] hover:bg-[#1f4529] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deploying ? 'Deploying...' : 'Deploy'}
      </button>
      {status && (
        <span className="max-w-[180px] truncate font-mono text-[11px] text-gray-500" title={status}>
          {status}
        </span>
      )}
    </div>
  )
}
