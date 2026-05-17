import { NextResponse } from 'next/server'
import { discoverScenes } from '@/lib/scenes'

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get('project')
  const scenes = discoverScenes(projectId)
  return NextResponse.json(scenes)
}
