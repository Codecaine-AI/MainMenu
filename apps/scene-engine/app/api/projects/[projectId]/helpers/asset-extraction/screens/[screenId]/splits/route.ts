import { NextResponse } from 'next/server'
import { createSplit } from '@/features/asset-extraction/store'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; screenId: string }> },
) {
  try {
    const { projectId, screenId } = await params
    const body = (await req.json()) as {
      parentNodeId?: unknown
      instruction?: unknown
      targetPrompt?: unknown
      residualPrompt?: unknown
    }
    if (typeof body.parentNodeId !== 'string' || typeof body.instruction !== 'string') {
      return NextResponse.json({ error: 'Parent node and instruction are required.' }, { status: 400 })
    }
    if (typeof body.targetPrompt !== 'string' || typeof body.residualPrompt !== 'string') {
      return NextResponse.json(
        { error: 'Target and residual prompts are required. Draft prompts before confirming the split.' },
        { status: 400 },
      )
    }
    const workspace = await createSplit({
      projectId,
      screenId,
      parentNodeId: body.parentNodeId,
      instruction: body.instruction,
      targetPrompt: body.targetPrompt,
      residualPrompt: body.residualPrompt,
    })
    return NextResponse.json(workspace)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Split creation failed.'
    return NextResponse.json(
      { error: message },
      { status: message.includes('already has a split') ? 409 : 500 },
    )
  }
}
