import { NextResponse } from 'next/server'
import { discoverProjectFontAssets } from '@/lib/font-discovery'

export async function GET(req: Request) {
  try {
    const projectId = new URL(req.url).searchParams.get('project')
    return NextResponse.json(await discoverProjectFontAssets(projectId, { urlMode: 'logical' }))
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Font discovery failed' },
      { status: 500 },
    )
  }
}
