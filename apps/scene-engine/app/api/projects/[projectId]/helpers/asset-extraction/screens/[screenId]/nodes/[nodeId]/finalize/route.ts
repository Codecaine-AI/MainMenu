import { NextResponse } from 'next/server'
import { setNodeFinal } from '@/features/asset-extraction/store'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; screenId: string; nodeId: string }> },
) {
  try {
    const { projectId, screenId, nodeId } = await params
    const body = (await req.json()) as { final?: unknown }
    const node = await setNodeFinal({
      projectId,
      screenId,
      nodeId,
      final: body.final !== false,
    })
    return NextResponse.json(node)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Node update failed.' },
      { status: 500 },
    )
  }
}
