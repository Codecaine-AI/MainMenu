import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ProjectManifest } from '@/types/scene'

export interface SceneDescriptor {
  id: string
  name: string
  objectCount: number
  isEntry: boolean
}

export function loadProject(): ProjectManifest | null {
  const projectPath = path.join(process.cwd(), 'project.json')
  if (!existsSync(projectPath)) return null
  try {
    return JSON.parse(readFileSync(projectPath, 'utf-8')) as ProjectManifest
  } catch {
    return null
  }
}

function readScene(id: string): { name?: string; objects?: unknown[] } | null {
  const jsonPath = path.join(process.cwd(), 'scenes', id, 'scene.json')
  if (!existsSync(jsonPath)) return null
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch {
    return null
  }
}

export function discoverScenes(): SceneDescriptor[] {
  const project = loadProject()
  if (project) {
    const out: SceneDescriptor[] = []
    for (const ref of project.scenes) {
      const scene = readScene(ref.id)
      out.push({
        id: ref.id,
        name: ref.name ?? scene?.name ?? ref.id,
        objectCount: Array.isArray(scene?.objects) ? scene!.objects!.length : 0,
        isEntry: ref.id === project.entry,
      })
    }
    return out
  }

  const scenesDir = path.join(process.cwd(), 'scenes')
  if (!existsSync(scenesDir)) return []
  const out: SceneDescriptor[] = []
  for (const id of readdirSync(scenesDir)) {
    const dir = path.join(scenesDir, id)
    if (!statSync(dir).isDirectory()) continue
    const jsonPath = path.join(dir, 'scene.json')
    if (!existsSync(jsonPath)) continue
    try {
      const scene = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      out.push({
        id,
        name: scene.name ?? id,
        objectCount: Array.isArray(scene.objects) ? scene.objects.length : 0,
        isEntry: false,
      })
    } catch {
      out.push({ id, name: id, objectCount: 0, isEntry: false })
    }
  }
  return out
}
