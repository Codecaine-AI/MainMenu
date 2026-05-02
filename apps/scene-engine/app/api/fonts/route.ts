import { NextResponse } from 'next/server'
import { discoverFontAssets } from '@/lib/font-discovery'

export async function GET() {
  try {
    return NextResponse.json(await discoverFontAssets())
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Font discovery failed' },
      { status: 500 },
    )
  }
}
