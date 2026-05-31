import type { SceneJson } from '@/types/scene'

interface SaveSceneInput {
  projectId: string | null
  sceneId: string
  scene: SceneJson
}

export async function saveScene({ projectId, sceneId, scene }: SaveSceneInput) {
  const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
  const res = await fetch(`/api/scenes/${sceneId}${projectQuery}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scene),
  })
  if (!res.ok) throw new Error(`Save failed: ${res.status}`)
}

export async function exportProject(projectId: string | null) {
  if (!projectId) throw new Error('No active project to export.')

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
