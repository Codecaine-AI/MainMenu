import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isAssetType, validateUpload, slugifyFilename } from '@/lib/asset-types'
import type { AssetContainer, AssetType } from '@/types/scene'

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'registry.json')

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

    const { slug, ext } = slugifyFilename(file.name)
    const dir = path.join(process.cwd(), 'public', 'assets', type)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const filename = ext ? `${slug}.${ext}` : slug
    const diskPath = path.join(dir, filename)
    await writeFile(diskPath, Buffer.from(await file.arrayBuffer()))

    const text = await readFile(REGISTRY_PATH, 'utf-8')
    const registry = JSON.parse(text) as Record<string, AssetContainer>
    registry[slug] = { type, file: `/assets/${type}/${filename}` }
    await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8')

    return NextResponse.json({ id: slug, type, file: registry[slug].file })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}
