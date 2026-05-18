import { NextResponse } from 'next/server'
import { generateNodeSplitImages } from '@/_lib/store'

export async function POST(
  _req: Request,
  { params }: { params: { projectId: string; screenId: string; nodeId: string } },
) {
  try {
    const { projectId, screenId, nodeId } = params
    const workspace = await generateNodeSplitImages({
      projectId,
      screenId,
      parentNodeId: nodeId,
    })
    return NextResponse.json(workspace)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Split image generation failed.'
    return NextResponse.json(
      { error: message },
      { status: message.includes('does not have a split') ? 404 : 500 },
    )
  }
}
