import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { ProjectManifest } from '@/types/scene'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface ProjectDescriptor {
  id: string
  name: string
  entry: string
  sceneCount: number
  isLegacyRoot: boolean
}

export interface SceneDescriptor {
  id: string
  name: string
  objectCount: number
  isEntry: boolean
}

function readProject(projectPath: string): ProjectManifest | null {
  try {
    return JSON.parse(readFileSync(projectPath, 'utf-8')) as ProjectManifest
  } catch {
    return null
  }
}

function readProjectAt(root: string): ProjectManifest | null {
  const projectPath = path.join(root, 'project.json')
  if (!existsSync(projectPath)) return null
  return readProject(projectPath)
}

function projectsDir() {
  return path.join(process.cwd(), 'projects')
}

function legacyProjectRoot(): string | null {
  return existsSync(path.join(process.cwd(), 'project.json')) ? process.cwd() : null
}

export function discoverProjects(): ProjectDescriptor[] {
  const out: ProjectDescriptor[] = []
  const root = projectsDir()
  if (existsSync(root)) {
    for (const id of readdirSync(root).sort()) {
      if (!ID_RE.test(id)) continue
      const dir = path.join(root, id)
      if (!statSync(dir).isDirectory()) continue
      const project = readProjectAt(dir)
      if (!project) continue
      out.push({
        id,
        name: project.name ?? id,
        entry: project.entry,
        sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
        isLegacyRoot: false,
      })
    }
  }

  const legacyRoot = legacyProjectRoot()
  if (legacyRoot) {
    const project = readProjectAt(legacyRoot)
    if (project && !out.some((p) => p.id === project.id)) {
      out.push({
        id: project.id,
        name: project.name ?? project.id,
        entry: project.entry,
        sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
        isLegacyRoot: true,
      })
    }
  }

  return out
}

export function defaultProjectId(): string | null {
  return discoverProjects()[0]?.id ?? null
}

export function projectRoot(projectId?: string | null): string | null {
  const id = projectId ?? defaultProjectId()
  if (!id || !ID_RE.test(id)) return null

  const dir = path.join(projectsDir(), id)
  if (existsSync(path.join(dir, 'project.json'))) return dir

  const legacyRoot = legacyProjectRoot()
  if (legacyRoot) {
    const project = readProjectAt(legacyRoot)
    if (project?.id === id) return legacyRoot
  }

  return null
}

export function loadProject(projectId?: string | null): ProjectManifest | null {
  const root = projectRoot(projectId)
  if (!root) return null
  return readProjectAt(root)
}

function readScene(root: string, id: string): { name?: string; objects?: unknown[] } | null {
  const jsonPath = path.join(root, 'scenes', id, 'scene.json')
  if (!existsSync(jsonPath)) return null
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch {
    return null
  }
}

export function discoverScenes(projectId?: string | null): SceneDescriptor[] {
  const root = projectRoot(projectId)
  const project = loadProject(projectId)
  if (project) {
    const out: SceneDescriptor[] = []
    for (const ref of project.scenes) {
      const scene = root ? readScene(root, ref.id) : null
      out.push({
        id: ref.id,
        name: ref.name ?? scene?.name ?? ref.id,
        objectCount: Array.isArray(scene?.objects) ? scene!.objects!.length : 0,
        isEntry: ref.id === project.entry,
      })
    }
    return out
  }

  if (!root) return []
  const scenesDir = path.join(root, 'scenes')
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
