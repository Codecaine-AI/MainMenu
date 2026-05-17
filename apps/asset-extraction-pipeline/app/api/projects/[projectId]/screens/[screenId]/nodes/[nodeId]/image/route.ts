import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { resolveNodeImage } from '@/_lib/store'

export async function GET(
  _req: Request,
  { params }: { params: { projectId: string; screenId: string; nodeId: string } },
) {
  try {
    const { projectId, screenId, nodeId } = params
    const resolved = await resolveNodeImage(projectId, screenId, nodeId)
    if (!resolved) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 })
    }
    const bytes = await readFile(resolved.filePath)
    return new Response(new Uint8Array(bytes), {
      headers: {
        'content-type': resolved.contentType,
        'cache-control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image loading failed.' },
      { status: 500 },
    )
  }
}
