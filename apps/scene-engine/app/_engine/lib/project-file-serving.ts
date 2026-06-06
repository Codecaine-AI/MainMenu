import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { resolveProjectPaths, safeResolveChild, type ProjectPaths } from '@/lib/project-paths'

type ProjectFileKind = 'assets' | 'modules' | 'fonts'

function contentType(absPath: string) {
  switch (path.extname(absPath).toLowerCase()) {
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
    case '.mjs':
      return 'application/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.ico':
      return 'image/x-icon'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.otf':
      return 'font/otf'
    case '.ttf':
      return 'font/ttf'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    default:
      return 'application/octet-stream'
  }
}

function isTextFile(absPath: string) {
  return ['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt'].includes(path.extname(absPath).toLowerCase())
}

export function rewriteProjectLogicalReferences(text: string, projectId: string) {
  const projectPrefix = `/api/projects/${encodeURIComponent(projectId)}`
  return text.replace(/(["'(`])\/(assets|modules|fonts)\//g, `$1${projectPrefix}/$2/`)
}

function rootForKind(paths: ProjectPaths, kind: ProjectFileKind) {
  if (kind === 'assets') return paths.mediaRoot
  if (kind === 'modules') return paths.modulesRoot
  return paths.fontsRoot
}

export async function projectFileResponse(
  projectId: string,
  kind: ProjectFileKind,
  childPath: string[],
) {
  const paths = resolveProjectPaths(projectId)
  if (!paths) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const absPath = safeResolveChild(rootForKind(paths, kind), childPath)
  if (!absPath || !existsSync(absPath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const info = await stat(absPath)
  if (!info.isFile()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const headers = {
    'Content-Type': contentType(absPath),
    'Cache-Control': 'no-store',
  }

  if (isTextFile(absPath)) {
    const text = rewriteProjectLogicalReferences(await readFile(absPath, 'utf-8'), projectId)
    return new NextResponse(text, { headers })
  }

  return new NextResponse(new Uint8Array(await readFile(absPath)), { headers })
}
