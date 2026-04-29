import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { isAssetType } from '@/lib/asset-types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params
  if (!isAssetType(type)) {
    return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 })
  }
  const dir = path.join(process.cwd(), 'public', 'assets', type)
  if (!existsSync(dir)) {
    return NextResponse.json({ files: [] })
  }
  const entries = await readdir(dir, { withFileTypes: true })
  const files = entries
    .filter((e) => e.isFile() && !e.name.startsWith('.'))
    .map((e) => ({ name: e.name, file: `/assets/${type}/${e.name}` }))
  return NextResponse.json({ files })
}
