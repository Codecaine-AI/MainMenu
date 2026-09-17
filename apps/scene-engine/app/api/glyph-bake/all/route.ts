import { NextResponse } from 'next/server'
import {
  bakeAllCodecaineGlyphs,
  GlyphBakeInputError,
  type GlyphBakeAllInput,
} from '@/lib/glyph-bake'

export const runtime = 'nodejs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new GlyphBakeInputError(`${name} must be a non-empty string`)
  }
  return value.trim()
}

function parseBody(body: unknown): GlyphBakeAllInput {
  if (!isRecord(body)) {
    throw new GlyphBakeInputError('Body must be a JSON object')
  }

  const projectId = requiredString(body.projectId, 'projectId')
  let text: string | undefined
  if (body.text !== undefined) {
    if (typeof body.text !== 'string' || !body.text.trim()) {
      throw new GlyphBakeInputError('text must be a non-empty string')
    }
    if (/[\\/\u0000-\u001f\u007f]/.test(body.text)) {
      throw new GlyphBakeInputError('text must not contain path separators or control characters')
    }
    text = body.text
  }

  let tracking: number | undefined
  if (body.tracking !== undefined) {
    if (typeof body.tracking !== 'number' || !Number.isFinite(body.tracking)) {
      throw new GlyphBakeInputError('tracking must be a finite number')
    }
    tracking = body.tracking
  }

  let gapAdjustments: number[] | undefined
  if (body.gapAdjustments !== undefined) {
    if (
      !Array.isArray(body.gapAdjustments)
      || !body.gapAdjustments.every((value) => typeof value === 'number' && Number.isFinite(value))
    ) {
      throw new GlyphBakeInputError('gapAdjustments must be an array of finite numbers')
    }
    gapAdjustments = body.gapAdjustments
  }

  return { projectId, text, tracking, gapAdjustments }
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    return NextResponse.json(await bakeAllCodecaineGlyphs(parseBody(body)))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Glyph bake failed'
    return NextResponse.json(
      { error: message },
      { status: error instanceof GlyphBakeInputError ? 400 : 500 },
    )
  }
}
