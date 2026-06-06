import { NextResponse } from 'next/server'
import { createScreen, type UploadedImageFile } from '@/features/asset-extraction/store'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await params
    const form = await req.formData()
    const name = form.get('name')
    const source: unknown = form.get('source')
    if (typeof name !== 'string') {
      return NextResponse.json({ error: 'Screen name is required.' }, { status: 400 })
    }
    if (!isUploadedImageFile(source)) {
      return NextResponse.json({ error: 'Source image is required.' }, { status: 400 })
    }
    const screen = await createScreen(projectId, name, source)
    return NextResponse.json(screen)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Screen creation failed.' },
      { status: 500 },
    )
  }
}

function isUploadedImageFile(value: unknown): value is UploadedImageFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  )
}
