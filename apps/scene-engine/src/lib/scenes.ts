import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface SceneDescriptor {
  id: string
  name: string
  objectCount: number
}

export function discoverScenes(): SceneDescriptor[] {
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
      })
    } catch {
      out.push({ id, name: id, objectCount: 0 })
    }
  }
  return out
}
