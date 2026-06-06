import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { defaultProjectId } from '@/lib/scenes'
import { projectApiUrl, resolveProjectPaths } from '@/lib/project-paths'
import type { AssetContainer } from '@/types/scene'

const FONT_EXTENSIONS = new Set(['.otf', '.ttf', '.woff', '.woff2'])
const WEIGHTS: Array<[RegExp, number]> = [
  [/thin/i, 100],
  [/extra[-_ ]?light|ultra[-_ ]?light/i, 200],
  [/light/i, 300],
  [/regular|normal|book/i, 400],
  [/medium/i, 500],
  [/semi[-_ ]?bold|demi[-_ ]?bold/i, 600],
  [/bold/i, 700],
  [/extra[-_ ]?bold|ultra[-_ ]?bold/i, 800],
  [/black|heavy/i, 900],
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleCase(value: string): string {
  return value
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s*family\s*$/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferFamily(relativeFile: string): string {
  const parts = relativeFile.split(path.sep)
  if (parts.length > 1) return titleCase(parts[0])
  return titleCase(parts[0])
}

function inferWeight(filename: string): number {
  for (const [pattern, weight] of WEIGHTS) {
    if (pattern.test(filename)) return weight
  }
  return 400
}

function toPublicUrl(baseUrl: string, relativeFile: string): string {
  const encoded = relativeFile.split(path.sep).map(encodeURIComponent).join('/')
  return `${baseUrl}/${encoded}`
}

async function walkFonts(absDir: string, relDir = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(absDir, { withFileTypes: true })
  } catch {
    return []
  }

  const files: string[] = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const childRel = relDir ? path.join(relDir, entry.name) : entry.name
    const childAbs = path.join(absDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFonts(childAbs, childRel))
    } else if (entry.isFile() && FONT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(childRel)
    }
  }
  return files
}

export async function discoverProjectFontAssets(
  projectId?: string | null,
  options: { urlMode?: 'logical' | 'project-api' } = {},
): Promise<Record<string, AssetContainer>> {
  const selectedProjectId = projectId ?? defaultProjectId()
  const paths = resolveProjectPaths(selectedProjectId)
  if (!paths) return {}

  const logicalSources = [
    { absDir: paths.fontsRoot, baseUrl: '/fonts', idPrefix: 'font' },
  ]
  const mediaFontDir = path.join(paths.mediaRoot, 'font')
  if (mediaFontDir !== paths.fontsRoot) {
    logicalSources.push({ absDir: mediaFontDir, baseUrl: '/assets/font', idPrefix: 'font-asset' })
  }
  const sources = logicalSources.map((source) => {
    if (options.urlMode !== 'project-api' || !selectedProjectId) return source
    return {
      ...source,
      baseUrl: projectApiUrl(selectedProjectId, source.baseUrl) ?? source.baseUrl,
    }
  })
  const registry: Record<string, AssetContainer> = {}

  for (const source of sources) {
    const files = await walkFonts(source.absDir)
    for (const file of files) {
      const filename = path.basename(file)
      const id = slugify(`${source.idPrefix}-${file}`)
      if (!id) continue
      registry[id] = {
        type: 'font',
        file: toPublicUrl(source.baseUrl, file),
        family: inferFamily(file),
        weight: inferWeight(filename),
        style: /italic/i.test(filename) ? 'italic' : 'normal',
      }
    }
  }

  return registry
}
