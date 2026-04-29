import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import type { AssetContainer } from '@/types/scene'

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'registry.json')

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
    }
    const file = (body as Record<string, unknown>).file
    if (typeof file !== 'string' || file === '') {
      return NextResponse.json(
        { error: 'Body must include a string `file` field' },
        { status: 400 },
      )
    }

    const text = await readFile(REGISTRY_PATH, 'utf-8')
    const registry = JSON.parse(text) as Record<string, AssetContainer>
    const entry = registry[id]
    if (!entry) {
      return NextResponse.json({ error: `Unknown container id: ${id}` }, { status: 404 })
    }

    const expectedPrefix = `/assets/${entry.type}/`
    if (!file.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `File path must be under ${expectedPrefix}` },
        { status: 400 },
      )
    }

    registry[id] = { ...entry, file }
    await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8')

    return NextResponse.json({ id, type: entry.type, file })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Registry update failed' },
      { status: 500 },
    )
  }
}
