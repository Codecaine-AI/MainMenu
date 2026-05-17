import { NextResponse } from 'next/server'
import { createProject } from '@/_lib/store'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: unknown }
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
    }
    const project = await createProject(body.name)
    return NextResponse.json(project)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Project creation failed.' },
      { status: 500 },
    )
  }
}
