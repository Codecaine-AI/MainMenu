import { NextResponse } from 'next/server'
import { isAssetType } from '@/lib/asset-types'
import { listAssetLibrary } from '@/lib/asset-library'
import { defaultProjectId } from '@/lib/scenes'
import type { AssetType } from '@/types/scene'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const typeParam = url.searchParams.get('type')
  const projectId = url.searchParams.get('project') ?? defaultProjectId()
  const includeUsage = url.searchParams.get('usage') !== '0'
  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  let type: AssetType | null = null
  if (typeParam) {
    if (!isAssetType(typeParam)) {
      return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
    }
    type = typeParam
  }

  const assets = listAssetLibrary({ type, projectId, includeUsage })
  return NextResponse.json({ assets })
}
