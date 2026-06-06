import type { AssetType } from '@/types/scene'

export type { AssetType } from '@/types/scene'

export const ASSET_TYPES = ['audio', 'image', 'video', 'glyph', 'font'] as const

export const ASSET_TYPE_RULES: Record<AssetType, { extensions: string[]; mimes: string[] }> = {
  audio: {
    extensions: ['mp3', 'wav', 'ogg'],
    mimes: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  },
  image: {
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico'],
    mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon'],
  },
  video: {
    extensions: ['mp4', 'webm'],
    mimes: ['video/mp4', 'video/webm'],
  },
  glyph: {
    extensions: ['svg'],
    mimes: ['image/svg+xml'],
  },
  font: {
    extensions: ['otf', 'ttf', 'woff', 'woff2'],
    mimes: [
      'font/otf',
      'font/ttf',
      'font/woff',
      'font/woff2',
      'application/font-sfnt',
      'application/font-woff',
      'application/x-font-ttf',
      'application/x-font-otf',
      'application/octet-stream',
      '',
    ],
  },
}

export function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value)
}

export function getTypeFromMime(mime: string): AssetType | null {
  const m = mime.toLowerCase()
  for (const t of ASSET_TYPES) {
    if (ASSET_TYPE_RULES[t].mimes.includes(m)) return t
  }
  return null
}

export function slugifyFilename(filename: string): { slug: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  const base = dot === -1 ? filename : filename.slice(0, dot)
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug === '') {
    throw new Error('Filename slugified to empty string')
  }
  return { slug, ext }
}

export function validateUpload(input: {
  type: string
  mime: string
  filename: string
}): { ok: true } | { ok: false; error: string } {
  const { type, mime, filename } = input
  if (!isAssetType(type)) {
    return { ok: false, error: `Invalid asset type: ${type}` }
  }
  const dot = filename.lastIndexOf('.')
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
  if (!ASSET_TYPE_RULES[type].extensions.includes(ext)) {
    return { ok: false, error: `Extension .${ext} not allowed for type ${type}` }
  }
  const m = mime.toLowerCase()
  if (!ASSET_TYPE_RULES[type].mimes.includes(m)) {
    return { ok: false, error: `Mime ${mime} not allowed for type ${type}` }
  }
  return { ok: true }
}
