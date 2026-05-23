import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isAssetType, validateUpload, slugifyFilename } from '@/lib/asset-types'
import type { AssetContainer, AssetScope, AssetType } from '@/types/scene'

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'registry.json')

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
    const projectId = typeof projectRaw === 'string' && projectRaw.trim() ? projectRaw.trim() : undefined
    const scopeRaw = form.get('scope')
    const scope: AssetScope = scopeRaw === 'project' && projectId ? 'project' : 'global'

    const { slug, ext } = slugifyFilename(file.name)
    const text = await readFile(REGISTRY_PATH, 'utf-8')
    const registry = JSON.parse(text) as Record<string, AssetContainer>
    const id = uniqueSlug(slug, new Set(Object.keys(registry)))
    const dir = path.join(process.cwd(), 'public', 'assets', type)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const filename = ext ? `${id}.${ext}` : id
    const diskPath = path.join(dir, filename)
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()))

    const now = new Date().toISOString()
    registry[id] = {
      type,
      file: `/assets/${type}/${filename}`,
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
    await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8')

    return NextResponse.json({ id, type, file: registry[id].file, label: registry[id].label, scope })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
