import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'
import { isAssetType } from '@/lib/asset-types'
import { listAssetLibrary } from '@/lib/asset-library'
import { defaultProjectId } from '@/lib/scenes'
import { resolveProjectPaths } from '@/lib/project-paths'
import type { AssetType } from '@/types/scene'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isAssetType(type)) {
    return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
  }
  const projectId = new URL(_req.url).searchParams.get('project') ?? defaultProjectId()
  const projectPaths = resolveProjectPaths(projectId)
  if (!projectPaths) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  const assets = listAssetLibrary({ type: type as AssetType, projectId, includeUsage: false })
  const dir = projectPaths.mediaDir(type as AssetType)
  if (!existsSync(dir)) {
    return NextResponse.json({ assets, files: [] })
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const logicalBase = type === 'font' ? '/fonts' : `/assets/${type}`
  const files = entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, file: `${logicalBase}/${e.name}` }))
  return NextResponse.json({ assets, files })
}
