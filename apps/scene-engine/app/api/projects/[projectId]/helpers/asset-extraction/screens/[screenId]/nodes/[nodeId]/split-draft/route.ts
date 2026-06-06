import { NextResponse } from 'next/server'
import { draftSplitPrompts } from '@/features/asset-extraction/store'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; screenId: string; nodeId: string }> },
) {
  try {
    const { projectId, screenId, nodeId } = await params
    const body = (await req.json()) as {
      instruction?: unknown
    }
    if (typeof body.instruction !== 'string') {
      return NextResponse.json({ error: 'Split instruction is required.' }, { status: 400 })
    }
    const draft = await draftSplitPrompts({
      projectId,
      screenId,
      parentNodeId: nodeId,
      instruction: body.instruction,
    })
    return NextResponse.json(draft)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prompt draft failed.'
    return NextResponse.json(
      { error: message },
      { status: message.includes('already has a split') ? 409 : 500 },
    )
  }
}
