import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isAssetType, validateUpload, slugifyFilename } from '@/lib/asset-types'
import { assetRegistryPath, readAssetRegistry, writeAssetRegistry } from '@/lib/asset-library'
import { defaultProjectId } from '@/lib/scenes'
import { resolveProjectPaths } from '@/lib/project-paths'
import type { AssetContainer, AssetScope, AssetType } from '@/types/scene'

function titleCaseFamily(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base
  let index = 2
  while (used.has(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    const typeRaw = form.get('type')
    if (typeof typeRaw !== 'string' || typeRaw === '') {
      return NextResponse.json({ error: 'Missing type' }, { status: 400 })
    }

    const result = validateUpload({ type: typeRaw, mime: file.type, filename: file.name })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    if (!isAssetType(typeRaw)) {
      return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
    }
    const type: AssetType = typeRaw
    const labelRaw = form.get('label')
    const label = typeof labelRaw === 'string' && labelRaw.trim() ? labelRaw.trim() : undefined
    const projectRaw = form.get('projectId')
    const projectId = typeof projectRaw === 'string' && projectRaw.trim() ? projectRaw.trim() : defaultProjectId()
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }
    const projectPaths = resolveProjectPaths(projectId)
    if (!projectPaths) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    const scopeRaw = form.get('scope')
    const scope: AssetScope = scopeRaw === 'project' && projectId ? 'project' : 'global'

    const { slug, ext } = slugifyFilename(file.name)
    const registry = readAssetRegistry(projectId)
    const id = uniqueSlug(slug, new Set(Object.keys(registry)))
    const dir = projectPaths.mediaDir(type)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const filename = ext ? `${id}.${ext}` : id
    const diskPath = path.join(dir, filename)
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()))

    const logicalFile = type === 'font' ? `/fonts/${filename}` : `/assets/${type}/${filename}`
    const now = new Date().toISOString()
    registry[id] = {
      type,
      file: logicalFile,
      label,
      scope,
      projectIds: scope === 'project' && projectId ? [projectId] : undefined,
      createdAt: now,
      updatedAt: now,
    }
    if (type === 'font') {
      registry[id].family = titleCaseFamily(id)
      registry[id].weight = 400
      registry[id].style = 'normal'
    }
    await mkdir(path.dirname(assetRegistryPath(projectId)), { recursive: true })
    writeAssetRegistry(registry, projectId)

    return NextResponse.json({ id, type, file: registry[id].file, label: registry[id].label, scope })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
