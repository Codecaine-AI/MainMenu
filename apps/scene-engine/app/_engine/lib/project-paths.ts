import path from 'node:path'
import {
  loadWorkspaceCatalog,
  type WorkspaceCatalogDiagnostic,
  type WorkspaceCatalogResult,
} from '@/lib/workspace-catalog'
import type { AssetType } from '@/types/scene'

export const PROJECT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type ProjectLayout = 'external'
export type ProjectSource = 'catalog'

export interface ProjectRootDescriptor {
  id: string
  name?: string
  description?: string
  root: string
  source: ProjectSource
  layout: ProjectLayout
  catalogPath?: string
}

export interface ProjectDiscoveryResult {
  catalog: WorkspaceCatalogResult
  projects: ProjectRootDescriptor[]
  diagnostics: WorkspaceCatalogDiagnostic[]
}

export interface ProjectPaths {
  id: string
  root: string
  layout: ProjectLayout
  source: ProjectSource
  manifestFile: string
  scenesDir: string
  assetRegistryFile: string
  moduleRegistryFile: string
  mediaRoot: string
  modulesRoot: string
  fontsRoot: string
  libraryDir: string
  buildsDir: string
  sceneDir: (sceneId: string) => string
  sceneFile: (sceneId: string) => string
  mediaDir: (type: AssetType) => string
  resolveLogicalFile: (logicalPath: string) => string | null
}

export function discoverProjectRoots(): ProjectDiscoveryResult {
  const catalog = loadWorkspaceCatalog()
  const projects: ProjectRootDescriptor[] = catalog.projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    root: project.root,
    source: 'catalog',
    layout: 'external',
    catalogPath: project.catalogPath,
  }))
  const diagnostics = [...catalog.diagnostics]

  return { catalog, projects, diagnostics }
}

export function defaultProjectRootDescriptor(): ProjectRootDescriptor | null {
  const discovered = discoverProjectRoots()
  const activeId = discovered.catalog.activeProjectId
  if (activeId) {
    const active = discovered.projects.find((project) => project.id === activeId)
    if (active) return active
  }
  return discovered.projects[0] ?? null
}

export function resolveProjectRootDescriptor(projectId?: string | null): ProjectRootDescriptor | null {
  const discovered = discoverProjectRoots()
  const id = projectId ?? discovered.catalog.activeProjectId ?? discovered.projects[0]?.id
  if (!id || !PROJECT_ID_RE.test(id)) return null
  return discovered.projects.find((project) => project.id === id) ?? null
}

function assertSceneId(sceneId: string) {
  if (!PROJECT_ID_RE.test(sceneId)) {
    throw new Error(`Invalid scene id: ${sceneId}`)
  }
}

function safeJoin(root: string, parts: string[]): string | null {
  if (parts.length === 0) return root
  const clean: string[] = []
  for (const part of parts) {
    let decoded: string
    try {
      decoded = decodeURIComponent(part)
    } catch {
      return null
    }
    if (!decoded || decoded === '.' || decoded === '..') return null
    if (decoded.startsWith('.') || decoded.includes('/') || decoded.includes('\\')) return null
    clean.push(decoded)
  }
  const resolved = path.resolve(root, ...clean)
  const relative = path.relative(root, resolved)
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return resolved
  return null
}

export function safeResolveChild(root: string, parts: string | string[]): string | null {
  const list = Array.isArray(parts) ? parts : parts.split('/').filter(Boolean)
  return safeJoin(root, list)
}

function normalizeLogicalPath(logicalPath: string): string | null {
  if (typeof logicalPath !== 'string' || !logicalPath.trim()) return null
  if (/^(?:[a-z]+:)?\/\//i.test(logicalPath)) return null
  const normalized = path.posix.normalize(logicalPath.startsWith('/') ? logicalPath : `/${logicalPath}`)
  if (normalized === '/' || normalized.includes('/../') || normalized.endsWith('/..')) return null
  return normalized
}

export function projectApiUrl(projectId: string, logicalPath: string): string | null {
  const normalized = normalizeLogicalPath(logicalPath)
  if (!normalized) return null
  if (!normalized.startsWith('/assets/') && !normalized.startsWith('/modules/') && !normalized.startsWith('/fonts/')) {
    return null
  }
  return `/api/projects/${encodeURIComponent(projectId)}${normalized}`
}

export function createProjectPaths(descriptor: ProjectRootDescriptor): ProjectPaths {
  const manifestFile = path.join(descriptor.root, 'ProjectSettings', 'project.json')
  const scenesDir = path.join(descriptor.root, 'Assets', 'Scenes')
  const mediaRoot = path.join(descriptor.root, 'Assets', 'Media')
  const modulesRoot = path.join(descriptor.root, 'Assets', 'Modules')
  const fontsRoot = path.join(descriptor.root, 'Assets', 'Fonts')
  const assetRegistryFile = path.join(descriptor.root, 'ProjectSettings', 'registries', 'assets.json')
  const moduleRegistryFile = path.join(descriptor.root, 'ProjectSettings', 'registries', 'modules.json')

  const paths: ProjectPaths = {
    id: descriptor.id,
    root: descriptor.root,
    layout: descriptor.layout,
    source: descriptor.source,
    manifestFile,
    scenesDir,
    assetRegistryFile,
    moduleRegistryFile,
    mediaRoot,
    modulesRoot,
    fontsRoot,
    libraryDir: path.join(descriptor.root, 'Library'),
    buildsDir: path.join(descriptor.root, 'Builds'),
    sceneDir: (sceneId: string) => {
      assertSceneId(sceneId)
      return path.join(scenesDir, sceneId)
    },
    sceneFile: (sceneId: string) => {
      assertSceneId(sceneId)
      return path.join(scenesDir, sceneId, 'scene.json')
    },
    mediaDir: (type: AssetType) => {
      return type === 'font' ? fontsRoot : path.join(mediaRoot, type)
    },
    resolveLogicalFile: (logicalPath: string) => {
      const normalized = normalizeLogicalPath(logicalPath)
      if (!normalized) return null
      if (normalized.startsWith('/assets/')) {
        return safeResolveChild(mediaRoot, normalized.replace(/^\/assets\//, ''))
      }
      if (normalized.startsWith('/modules/')) {
        return safeResolveChild(modulesRoot, normalized.replace(/^\/modules\//, ''))
      }
      if (normalized.startsWith('/fonts/')) {
        return safeResolveChild(fontsRoot, normalized.replace(/^\/fonts\//, ''))
      }
      return null
    },
  }

  return paths
}

export function resolveProjectPaths(projectId?: string | null): ProjectPaths | null {
  const descriptor = resolveProjectRootDescriptor(projectId)
  return descriptor ? createProjectPaths(descriptor) : null
}
