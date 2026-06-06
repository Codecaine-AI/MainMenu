'use client'

export async function exportProject(projectId: string) {
  const res = await fetch(`/api/export?project=${encodeURIComponent(projectId)}`, { method: 'POST' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Export failed: ${res.status} ${text}`)
  }

  const blob = await res.blob()
  const header = res.headers.get('Content-Disposition')
  const match = header?.match(/filename="?([^"]+)"?/i)
  const filename = match ? match[1] : `${projectId}.zip`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function deployProject(projectId: string) {
  if (!window.confirm('Commit and push the saved project workspace for deployment?')) return

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/deploy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    message?: string
    pushed?: boolean
    shortCommit?: string
  }
  if (!res.ok) throw new Error(json.error ?? `Deploy failed: ${res.status}`)
}
