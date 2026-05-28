import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import type { ProjectManifest } from '@/types/scene'
import {
  PROJECT_ID_RE,
  createProjectPaths,
  defaultProjectRootDescriptor,
  discoverProjectRoots,
  resolveProjectPaths,
  type ProjectSource,
  type ProjectLayout,
} from '@/lib/project-paths'
import type { WorkspaceCatalogDiagnostic } from '@/lib/workspace-catalog'

export interface ProjectDescriptor {
  id: string
  name: string
  entry: string
  sceneCount: number
  isLegacyRoot: boolean
  root: string
  source: ProjectSource
  layout: ProjectLayout
  description?: string
}

export interface SceneDescriptor {
  id: string
  name: string
  objectCount: number
  isEntry: boolean
}

export interface ProjectDiscoveryWithDiagnostics {
  projects: ProjectDescriptor[]
  diagnostics: WorkspaceCatalogDiagnostic[]
}

function readProject(projectPath: string): ProjectManifest | null {
  try {
    return JSON.parse(readFileSync(projectPath, 'utf-8')) as ProjectManifest
  } catch {
    return null
  }
}

export function discoverProjectsWithDiagnostics(): ProjectDiscoveryWithDiagnostics {
  const discovered = discoverProjectRoots()
  const diagnostics = [...discovered.diagnostics]
  const projects: ProjectDescriptor[] = []

  for (const descriptor of discovered.projects) {
    const paths = createProjectPaths(descriptor)
    if (!existsSync(paths.manifestFile)) {
      diagnostics.push({
        level: 'error',
        code: 'project_manifest_missing',
        message: `Project '${descriptor.id}' is missing its manifest: ${paths.manifestFile}`,
        projectId: descriptor.id,
        root: descriptor.root,
      })
      continue
    }
    const project = readProject(paths.manifestFile)
    if (!project) {
      diagnostics.push({
        level: 'error',
        code: 'project_manifest_unreadable',
        message: `Project '${descriptor.id}' manifest could not be parsed.`,
        projectId: descriptor.id,
        root: descriptor.root,
      })
      continue
    }
    projects.push({
      id: project.id ?? descriptor.id,
      name: project.name ?? descriptor.name ?? descriptor.id,
      entry: project.entry,
      sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
      isLegacyRoot: descriptor.isLegacyRoot,
      root: descriptor.root,
      source: descriptor.source,
      layout: descriptor.layout,
      description: descriptor.description,
    })
  }

  return { projects, diagnostics }
}

export function discoverProjects(): ProjectDescriptor[] {
  return discoverProjectsWithDiagnostics().projects
}

export function defaultProjectId(): string | null {
  return defaultProjectRootDescriptor()?.id ?? discoverProjects()[0]?.id ?? null
}

export function projectRoot(projectId?: string | null): string | null {
  return resolveProjectPaths(projectId)?.root ?? null
}

export function loadProject(projectId?: string | null): ProjectManifest | null {
  const paths = resolveProjectPaths(projectId)
  if (!paths || !existsSync(paths.manifestFile)) return null
  return readProject(paths.manifestFile)
}

function readSceneFile(jsonPath: string): { name?: string; objects?: unknown[] } | null {
  if (!existsSync(jsonPath)) return null
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf-8'))
  } catch {
    return null
  }
}

export function discoverScenes(projectId?: string | null): SceneDescriptor[] {
  const paths = resolveProjectPaths(projectId)
  const project = loadProject(projectId)
  if (project) {
    const out: SceneDescriptor[] = []
    for (const ref of project.scenes) {
      const scene = paths ? readSceneFile(paths.sceneFile(ref.id)) : null
      out.push({
        id: ref.id,
        name: ref.name ?? scene?.name ?? ref.id,
        objectCount: Array.isArray(scene?.objects) ? scene!.objects!.length : 0,
        isEntry: ref.id === project.entry,
      })
    }
    return out
  }

  if (!paths) return []
  const scenesDir = paths.scenesDir
  if (!existsSync(scenesDir)) return []
  const out: SceneDescriptor[] = []
  for (const id of readdirSync(scenesDir)) {
    if (!PROJECT_ID_RE.test(id)) continue
    const dir = paths.sceneDir(id)
    if (!statSync(dir).isDirectory()) continue
    const jsonPath = paths.sceneFile(id)
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
