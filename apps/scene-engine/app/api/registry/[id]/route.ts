import { NextResponse } from 'next/server'
import { readAssetRegistry, writeAssetRegistry } from '@/lib/asset-library'
import { defaultProjectId } from '@/lib/scenes'
import type { AssetContainer } from '@/types/scene'

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
    const url = new URL(req.url)
    const bodyRecord = body as Record<string, unknown>
    const projectRaw = url.searchParams.get('project') ?? bodyRecord.projectId
    const projectId = typeof projectRaw === 'string' && projectRaw.trim()
      ? projectRaw.trim()
      : defaultProjectId()
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }
    const file = (body as Record<string, unknown>).file
    if (typeof file !== 'string' || file === '') {
      return NextResponse.json(
        { error: 'Body must include a string `file` field' },
        { status: 400 },
      )
    }

    const registry = readAssetRegistry(projectId)
    const entry = registry[id]
    if (!entry) {
      return NextResponse.json({ error: `Unknown container id: ${id}` }, { status: 404 })
    }

    const expectedPrefix = entry.type === 'font' ? '/fonts/' : `/assets/${entry.type}/`
    if (!file.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: `File path must be under ${expectedPrefix}` },
        { status: 400 },
      )
    }

    registry[id] = { ...entry, file }
    writeAssetRegistry(registry, projectId)

    return NextResponse.json({ id, type: entry.type, file })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Registry update failed' },
      { status: 500 },
    )
  }
}
