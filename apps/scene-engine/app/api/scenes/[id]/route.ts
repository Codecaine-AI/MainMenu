import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import { NextResponse } from 'next/server'

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function scenePath(id: string) {
  return path.join(process.cwd(), 'scenes', id, 'scene.json')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid scene id' }, { status: 400 })
  }
  const file = scenePath(id)
  if (!existsSync(file)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const text = await readFile(file, 'utf-8')
  return new NextResponse(text, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid scene id' }, { status: 400 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 })
  }
  const dir = path.join(process.cwd(), 'scenes', id)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  await writeFile(scenePath(id), JSON.stringify(body, null, 2) + '\n', 'utf-8')
  return new NextResponse(null, { status: 204 })
}
