import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const WORKSPACE_CATALOG_ENV = 'SCENE_ENGINE_WORKSPACE_CATALOG'
export const DEFAULT_WORKSPACE_CATALOG = 'workspace.catalog.json'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export interface WorkspaceCatalogProject {
  id: string
  name?: string
  root: string
  enabled?: boolean
  description?: string
}

interface WorkspaceCatalogFile {
  version?: number
  activeProjectId?: string
  projects?: WorkspaceCatalogProject[]
}

export interface WorkspaceCatalogProjectRecord extends WorkspaceCatalogProject {
  catalogPath: string
  root: string
}

export interface WorkspaceCatalogDiagnostic {
  level: 'warning' | 'error'
  code: string
  message: string
  projectId?: string
  root?: string
}

export interface WorkspaceCatalogResult {
  path: string
  exists: boolean
  version: number | null
  activeProjectId: string | null
  projects: WorkspaceCatalogProjectRecord[]
  diagnostics: WorkspaceCatalogDiagnostic[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function workspaceCatalogPath() {
  const configured = process.env[WORKSPACE_CATALOG_ENV]
  if (configured?.trim()) {
    return path.resolve(process.cwd(), configured.trim())
  }
  return path.join(process.cwd(), DEFAULT_WORKSPACE_CATALOG)
}

function diagnostic(input: WorkspaceCatalogDiagnostic): WorkspaceCatalogDiagnostic {
  return input
}

export function loadWorkspaceCatalog(catalogPath = workspaceCatalogPath()): WorkspaceCatalogResult {
  const out: WorkspaceCatalogResult = {
    path: catalogPath,
    exists: existsSync(catalogPath),
    version: null,
    activeProjectId: null,
    projects: [],
    diagnostics: [],
  }

  if (!out.exists) return out

  let parsed: WorkspaceCatalogFile
  try {
    parsed = JSON.parse(readFileSync(catalogPath, 'utf-8')) as WorkspaceCatalogFile
  } catch (err) {
    out.diagnostics.push(diagnostic({
      level: 'error',
      code: 'catalog_unreadable',
      message: err instanceof Error ? err.message : 'Workspace catalog could not be read.',
    }))
    return out
  }

  if (!isObject(parsed)) {
    out.diagnostics.push(diagnostic({
      level: 'error',
      code: 'catalog_invalid_shape',
      message: 'Workspace catalog must be a JSON object.',
    }))
    return out
  }

  out.version = typeof parsed.version === 'number' ? parsed.version : null
  out.activeProjectId = typeof parsed.activeProjectId === 'string' ? parsed.activeProjectId : null
  if (out.version !== 1) {
    out.diagnostics.push(diagnostic({
      level: 'error',
      code: 'catalog_unsupported_version',
      message: `Unsupported workspace catalog version: ${String(parsed.version ?? 'missing')}.`,
    }))
    return out
  }
  if (!Array.isArray(parsed.projects)) {
    out.diagnostics.push(diagnostic({
      level: 'error',
      code: 'catalog_missing_projects',
      message: 'Workspace catalog must include a projects array.',
    }))
    return out
  }

  const seen = new Set<string>()
  const baseDir = path.dirname(catalogPath)
  for (const [index, project] of parsed.projects.entries()) {
    if (!isObject(project)) {
      out.diagnostics.push(diagnostic({
        level: 'error',
        code: 'project_invalid_shape',
        message: `Catalog project at index ${index} must be an object.`,
      }))
      continue
    }

    const id = typeof project.id === 'string' ? project.id.trim() : ''
    const rootRaw = typeof project.root === 'string' ? project.root.trim() : ''
    if (!ID_RE.test(id)) {
      out.diagnostics.push(diagnostic({
        level: 'error',
        code: 'project_invalid_id',
        message: `Catalog project at index ${index} has an invalid id.`,
        projectId: id || undefined,
      }))
      continue
    }
    if (seen.has(id)) {
      out.diagnostics.push(diagnostic({
        level: 'error',
        code: 'project_duplicate_id',
        message: `Duplicate project id '${id}' in workspace catalog.`,
        projectId: id,
      }))
      continue
    }
    seen.add(id)

    if (project.enabled === false) {
      out.diagnostics.push(diagnostic({
        level: 'warning',
        code: 'project_disabled',
        message: `Project '${id}' is disabled in the workspace catalog.`,
        projectId: id,
      }))
      continue
    }
    if (!rootRaw) {
      out.diagnostics.push(diagnostic({
        level: 'error',
        code: 'project_missing_root',
        message: `Project '${id}' is missing a root path.`,
        projectId: id,
      }))
      continue
    }

    const root = path.resolve(baseDir, rootRaw)
    const info = existsSync(root) ? statSync(root) : null
    if (!info?.isDirectory()) {
      out.diagnostics.push(diagnostic({
        level: 'error',
        code: 'project_root_missing',
        message: `Project '${id}' root does not exist or is not a directory: ${rootRaw}`,
        projectId: id,
        root,
      }))
      continue
    }

    out.projects.push({
      id,
      name: typeof project.name === 'string' && project.name.trim() ? project.name.trim() : undefined,
      description: typeof project.description === 'string' ? project.description : undefined,
      enabled: typeof project.enabled === 'boolean' ? project.enabled : undefined,
      root,
      catalogPath,
    })
  }

  return out
}
