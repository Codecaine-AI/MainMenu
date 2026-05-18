import { NextResponse } from 'next/server'
import { updateProjectName } from '@/_lib/store'

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } },
) {
  try {
    const body = (await req.json()) as { name?: unknown }
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
    }
    const project = await updateProjectName(params.projectId, body.name)
    return NextResponse.json(project)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Project update failed.' },
      { status: 500 },
    )
  }
}
