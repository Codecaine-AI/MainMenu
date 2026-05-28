import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { discoverProjectFontAssets } from '@/lib/font-discovery'
import { resolveProjectPaths } from '@/lib/project-paths'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; registry: string }> },
) {
  const { projectId, registry } = await params
  const paths = resolveProjectPaths(projectId)
  if (!paths) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (registry === 'fonts') {
    return NextResponse.json(await discoverProjectFontAssets(projectId, { urlMode: 'logical' }))
  }

  const file = registry === 'assets'
    ? paths.assetRegistryFile
    : registry === 'modules'
      ? paths.moduleRegistryFile
      : null
  if (!file) {
    return NextResponse.json({ error: 'Unknown registry' }, { status: 404 })
  }
  if (!existsSync(file)) {
    return NextResponse.json({})
  }

  return new NextResponse(await readFile(file, 'utf-8'), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
