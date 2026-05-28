import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import {
  loadWorkspaceCatalog,
  type WorkspaceCatalogDiagnostic,
  type WorkspaceCatalogResult,
} from '@/lib/workspace-catalog'
import type { AssetType } from '@/types/scene'

export const PROJECT_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type ProjectLayout = 'external' | 'legacy'
export type ProjectSource = 'catalog' | 'embedded' | 'legacy-root'

export interface ProjectRootDescriptor {
  id: string
  name?: string
  description?: string
  root: string
  source: ProjectSource
  layout: ProjectLayout
  isLegacyRoot: boolean
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
  appRoot: string
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

function embeddedProjectsDir(appRoot = process.cwd()) {
  return path.join(appRoot, 'projects')
}

function legacyProjectRoot(appRoot = process.cwd()): string | null {
  return existsSync(path.join(appRoot, 'project.json')) ? appRoot : null
}

function pushIfUnique(
  projects: ProjectRootDescriptor[],
  descriptor: ProjectRootDescriptor,
) {
  if (projects.some((project) => project.id === descriptor.id)) return
  projects.push(descriptor)
}

export function discoverProjectRoots(appRoot = process.cwd()): ProjectDiscoveryResult {
  const catalog = loadWorkspaceCatalog()
  const projects: ProjectRootDescriptor[] = catalog.projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    root: project.root,
    source: 'catalog',
    layout: 'external',
    isLegacyRoot: false,
    catalogPath: project.catalogPath,
  }))
  const diagnostics = [...catalog.diagnostics]

  const root = embeddedProjectsDir(appRoot)
  if (existsSync(root)) {
    for (const id of readdirSync(root).sort()) {
      if (!PROJECT_ID_RE.test(id)) continue
      const dir = path.join(root, id)
      if (!statSync(dir).isDirectory()) continue
      if (!existsSync(path.join(dir, 'project.json'))) continue
      pushIfUnique(projects, {
        id,
        root: dir,
        source: 'embedded',
        layout: 'legacy',
        isLegacyRoot: false,
      })
    }
  }

  const legacyRoot = legacyProjectRoot(appRoot)
  if (legacyRoot) {
    pushIfUnique(projects, {
      id: 'legacy',
      root: legacyRoot,
      source: 'legacy-root',
      layout: 'legacy',
      isLegacyRoot: true,
    })
  }

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

export function createProjectPaths(descriptor: ProjectRootDescriptor, appRoot = process.cwd()): ProjectPaths {
  const external = descriptor.layout === 'external'
  const manifestFile = external
    ? path.join(descriptor.root, 'ProjectSettings', 'project.json')
    : path.join(descriptor.root, 'project.json')
  const scenesDir = external
    ? path.join(descriptor.root, 'Assets', 'Scenes')
    : path.join(descriptor.root, 'scenes')
  const mediaRoot = external
    ? path.join(descriptor.root, 'Assets', 'Media')
    : path.join(appRoot, 'public', 'assets')
  const modulesRoot = external
    ? path.join(descriptor.root, 'Assets', 'Modules')
    : path.join(appRoot, 'public', 'modules')
  const fontsRoot = external
    ? path.join(descriptor.root, 'Assets', 'Fonts')
    : path.join(appRoot, 'public', 'fonts')
  const assetRegistryFile = external
    ? path.join(descriptor.root, 'ProjectSettings', 'registries', 'assets.json')
    : path.join(appRoot, 'public', 'assets', 'registry.json')
  const moduleRegistryFile = external
    ? path.join(descriptor.root, 'ProjectSettings', 'registries', 'modules.json')
    : path.join(appRoot, 'public', 'modules', 'registry.json')

  const paths: ProjectPaths = {
    id: descriptor.id,
    root: descriptor.root,
    appRoot,
    layout: descriptor.layout,
    source: descriptor.source,
    manifestFile,
    scenesDir,
    assetRegistryFile,
    moduleRegistryFile,
    mediaRoot,
    modulesRoot,
    fontsRoot,
    libraryDir: external ? path.join(descriptor.root, 'Library') : path.join(descriptor.root, '.library'),
    buildsDir: external ? path.join(descriptor.root, 'Builds') : path.join(descriptor.root, 'builds'),
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
