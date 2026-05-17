import { NextResponse } from 'next/server'
import { createSplit } from '@/_lib/store'

export async function POST(
  req: Request,
  { params }: { params: { projectId: string; screenId: string } },
) {
  try {
    const { projectId, screenId } = params
    const body = (await req.json()) as {
      parentNodeId?: unknown
      instruction?: unknown
    }
    if (typeof body.parentNodeId !== 'string' || typeof body.instruction !== 'string') {
      return NextResponse.json({ error: 'Parent node and instruction are required.' }, { status: 400 })
    }
    const workspace = await createSplit({
      projectId,
      screenId,
      parentNodeId: body.parentNodeId,
      instruction: body.instruction,
    })
    return NextResponse.json(workspace)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Split creation failed.' },
      { status: 500 },
    )
  }
}
