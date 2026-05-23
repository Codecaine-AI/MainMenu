import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isAssetType } from '@/lib/asset-types'
import { listAssetLibrary } from '@/lib/asset-library'
import type { AssetType } from '@/types/scene'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isAssetType(type)) {
    return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
  }
  const projectId = new URL(_req.url).searchParams.get('project')
  const assets = listAssetLibrary({ type: type as AssetType, projectId, includeUsage: false })
  const dir = path.join(process.cwd(), 'public', 'assets', type)
  if (!existsSync(dir)) {
    return NextResponse.json({ assets, files: [] })
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, file: `/assets/${type}/${e.name}` }))
  return NextResponse.json({ assets, files })
}
