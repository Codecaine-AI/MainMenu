import { NextResponse } from 'next/server'
import { isAssetType } from '@/lib/asset-types'
import { listAssetLibrary } from '@/lib/asset-library'
import type { AssetType } from '@/types/scene'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const typeParam = url.searchParams.get('type')
  const projectId = url.searchParams.get('project')
  const includeUsage = url.searchParams.get('usage') !== '0'

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
