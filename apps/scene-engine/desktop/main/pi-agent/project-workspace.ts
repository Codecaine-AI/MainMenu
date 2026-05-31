import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { MainMenuAgentContext } from '../../types/main-menu'

const WORKSPACE_CATALOG_ENV = 'SCENE_ENGINE_WORKSPACE_CATALOG'
const DEFAULT_WORKSPACE_CATALOG = 'workspace.catalog.json'
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface WorkspaceCatalogProject {
  id?: unknown
  name?: unknown
  root?: unknown
  enabled?: unknown
}

interface WorkspaceCatalogFile {
  version?: unknown
  activeProjectId?: unknown
  projects?: unknown
}

interface ResolveInput {
  appRoot: string
  packagedWorkspacePath: string | null
  context?: MainMenuAgentContext | null
}

export interface AgentWorkspace {
  projectId: string | null
  name: string | null
  cwd: string
  source: 'catalog' | 'app-root'
  catalogPath: string | null
  manifestFile: string | null
  sceneFile: string | null
  assetRegistryFile: string | null
  moduleRegistryFile: string | null
}

function configuredCatalogPath(appRoot: string) {
  const configured = process.env[WORKSPACE_CATALOG_ENV]?.trim()
  if (!configured) return null
  return path.isAbsolute(configured) ? configured : path.resolve(appRoot, configured)
}

function defaultCatalogPath(input: Pick<ResolveInput, 'appRoot' | 'packagedWorkspacePath'>) {
  if (input.packagedWorkspacePath) return path.join(input.packagedWorkspacePath, DEFAULT_WORKSPACE_CATALOG)
  return path.join(input.appRoot, DEFAULT_WORKSPACE_CATALOG)
}

function catalogPath(input: Pick<ResolveInput, 'appRoot' | 'packagedWorkspacePath'>) {
  return configuredCatalogPath(input.appRoot) ?? defaultCatalogPath(input)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readCatalog(file: string): WorkspaceCatalogFile | null {
  if (!existsSync(file)) return null
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as unknown
    return isObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

function projectRoot(catalogFile: string, project: WorkspaceCatalogProject): string | null {
  if (project.enabled === false || typeof project.root !== 'string' || !project.root.trim()) return null
  const root = path.resolve(path.dirname(catalogFile), project.root.trim())
  try {
    return statSync(root).isDirectory() ? root : null
  } catch {
    return null
  }
}

function externalProjectFiles(root: string, sceneId?: string | null) {
  const sceneFile = sceneId && ID_RE.test(sceneId) ? path.join(root, 'Assets', 'Scenes', sceneId, 'scene.json') : null
  return {
    manifestFile: path.join(root, 'ProjectSettings', 'project.json'),
    sceneFile,
    assetRegistryFile: path.join(root, 'ProjectSettings', 'registries', 'assets.json'),
    moduleRegistryFile: path.join(root, 'ProjectSettings', 'registries', 'modules.json'),
  }
}

function appRootWorkspace(appRoot: string, context?: MainMenuAgentContext | null): AgentWorkspace {
  return {
    projectId: context?.projectId ?? null,
    name: null,
    cwd: appRoot,
    source: 'app-root',
    catalogPath: null,
    manifestFile: null,
    sceneFile: null,
    assetRegistryFile: null,
    moduleRegistryFile: null,
  }
}

export function resolveAgentWorkspace(input: ResolveInput): AgentWorkspace {
  const file = catalogPath(input)
  const catalog = readCatalog(file)
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.projects)) {
    return appRootWorkspace(input.appRoot, input.context)
  }

  const requestedProjectId = input.context?.projectId
  const activeProjectId = typeof catalog.activeProjectId === 'string' ? catalog.activeProjectId : null
  const projectId = requestedProjectId ?? activeProjectId
  const candidates = catalog.projects.filter(isObject) as WorkspaceCatalogProject[]
  const match = projectId
    ? candidates.find((project) => project.id === projectId)
    : candidates.find((project) => project.enabled !== false)

  if (!match || typeof match.id !== 'string' || !ID_RE.test(match.id)) {
    return appRootWorkspace(input.appRoot, input.context)
  }

  const root = projectRoot(file, match)
  if (!root) return appRootWorkspace(input.appRoot, input.context)

  return {
    projectId: match.id,
    name: typeof match.name === 'string' && match.name.trim() ? match.name.trim() : null,
    cwd: root,
    source: 'catalog',
    catalogPath: file,
    ...externalProjectFiles(root, input.context?.sceneId),
  }
}
