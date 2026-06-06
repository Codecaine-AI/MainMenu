import { NextResponse } from 'next/server'
import { deleteNodeSplit } from '@/features/asset-extraction/store'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; screenId: string; nodeId: string }> },
) {
  try {
    const { projectId, screenId, nodeId } = await params
    const workspace = await deleteNodeSplit({
      projectId,
      screenId,
      parentNodeId: nodeId,
    })
    return NextResponse.json(workspace)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Split deletion failed.'
    return NextResponse.json(
      { error: message },
      { status: message.includes('does not have a split') ? 404 : 500 },
    )
  }
}
