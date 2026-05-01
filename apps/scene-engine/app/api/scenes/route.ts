import { NextResponse } from 'next/server'
import { discoverScenes } from '@/lib/scenes'

export async function GET() {
  const scenes = discoverScenes()
  return NextResponse.json(scenes)
}
