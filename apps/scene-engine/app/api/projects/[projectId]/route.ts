import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { normalizePostProcessing } from '@/lib/post-processing'
import { PROJECT_ID_RE, resolveProjectPaths } from '@/lib/project-paths'
import type { ProjectManifest, ProjectWebSettings } from '@/types/scene'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function readManifest(file: string): Promise<ProjectManifest | null> {
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as ProjectManifest
  } catch {
    return null
  }
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanFavicon(value: unknown) {
  const favicon = cleanString(value)
  if (!favicon) return ''
  if (!favicon.startsWith('/assets/')) {
    throw new Error('Favicon must be a project asset path beginning with /assets/.')
  }
  if (favicon.includes('..') || favicon.includes('\\')) {
    throw new Error('Favicon path is invalid.')
  }
  return favicon
}

function nextWebSettings(current: ProjectWebSettings | undefined, value: unknown): ProjectWebSettings {
  if (!isRecord(value)) return current ?? {}

  const next: ProjectWebSettings = { ...(current ?? {}) }
  if ('title' in value) {
    const title = cleanString(value.title)
    if (title) next.title = title
    else delete next.title
  }
  if ('favicon' in value) {
    const favicon = cleanFavicon(value.favicon)
    if (favicon) next.favicon = favicon
    else delete next.favicon
  }
  return next
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  if (!PROJECT_ID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }
  const paths = resolveProjectPaths(projectId)
  if (!paths || !existsSync(paths.manifestFile)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const project = await readManifest(paths.manifestFile)
  if (!project) {
    return NextResponse.json({ error: 'Project manifest could not be read' }, { status: 500 })
  }
  return NextResponse.json(project)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  if (!PROJECT_ID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }
  const paths = resolveProjectPaths(projectId)
  if (!paths || !existsSync(paths.manifestFile)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
  }

  const project = await readManifest(paths.manifestFile)
  if (!project) {
    return NextResponse.json({ error: 'Project manifest could not be read' }, { status: 500 })
  }

  let web: ProjectWebSettings
  try {
    web = nextWebSettings(project.web, body.web)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Project settings are invalid' },
      { status: 400 },
    )
  }

  const nextProject: ProjectManifest = {
    ...project,
    web,
  }
  if (Object.keys(web).length === 0) delete nextProject.web
  if ('postProcessing' in body) {
    if (body.postProcessing === null) {
      delete nextProject.postProcessing
    } else if (isRecord(body.postProcessing)) {
      nextProject.postProcessing = normalizePostProcessing(body.postProcessing)
    }
  }

  await writeFile(paths.manifestFile, JSON.stringify(nextProject, null, 2) + '\n', 'utf-8')
  return NextResponse.json(nextProject)
}
