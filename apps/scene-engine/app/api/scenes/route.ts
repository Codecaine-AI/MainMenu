import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { discoverScenes } from '@/lib/scenes'
import { PROJECT_ID_RE, resolveProjectPaths } from '@/lib/project-paths'
import type { ProjectManifest, SceneJson, StageDef } from '@/types/scene'

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('project')
  const scenes = discoverScenes(projectId)
  return NextResponse.json(scenes)
}

function sceneIdFromName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStage(stage: unknown): StageDef {
  if (isRecord(stage)) {
    const width = Number(stage.width)
    const height = Number(stage.height)
    if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
      return { width, height }
    }
  }
  return { width: 1440, height: 1080 }
}

async function readProjectManifest(file: string): Promise<ProjectManifest | null> {
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as ProjectManifest
  } catch {
    return null
  }
}

function uniqueGeneratedId(baseId: string, isTaken: (id: string) => boolean) {
  if (!isTaken(baseId)) return baseId
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseId}-${index}`
    if (!isTaken(candidate)) return candidate
  }
  return null
}

export async function POST(req: Request) {
  const projectId = new URL(req.url).searchParams.get('project')
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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: 'Scene name is required' }, { status: 400 })
  }

  const explicitId = typeof body.id === 'string' ? sceneIdFromName(body.id) : ''
  const generatedId = sceneIdFromName(name)
  const baseId = explicitId || generatedId
  if (!baseId || !PROJECT_ID_RE.test(baseId)) {
    return NextResponse.json({ error: 'Scene id must contain letters or numbers' }, { status: 400 })
  }

  const project = await readProjectManifest(paths.manifestFile)
  if (!project) {
    return NextResponse.json({ error: 'Project manifest could not be read' }, { status: 500 })
  }

  const sceneRefs = Array.isArray(project.scenes) ? project.scenes : []
  const existingIds = new Set(sceneRefs.map((scene) => scene.id))
  const requestedId = explicitId || null
  const isTaken = (sceneId: string) => existingIds.has(sceneId) || existsSync(paths.sceneFile(sceneId))
  const id = requestedId ? baseId : uniqueGeneratedId(baseId, isTaken)

  if (!id) {
    return NextResponse.json({ error: 'Could not create a unique scene id' }, { status: 409 })
  }
  if (isTaken(id)) {
    return NextResponse.json({ error: `Scene '${id}' already exists` }, { status: 409 })
  }

  const scene: SceneJson = {
    id,
    name,
    stage: normalizeStage(project.stage),
    objects: [],
  }
  const nextProject: ProjectManifest = {
    ...project,
    entry: project.entry || id,
    scenes: [...sceneRefs, { id, name }],
    stage: normalizeStage(project.stage),
  }

  await mkdir(paths.sceneDir(id), { recursive: true })
  await writeFile(paths.sceneFile(id), JSON.stringify(scene, null, 2) + '\n', 'utf-8')
  await writeFile(paths.manifestFile, JSON.stringify(nextProject, null, 2) + '\n', 'utf-8')

  return NextResponse.json({ id, name })
}
