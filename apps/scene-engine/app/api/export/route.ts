import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadProject, projectRoot } from '@/lib/scenes'
import { discoverFontAssets } from '@/lib/font-discovery'
import type { ProjectManifest } from '@/types/scene'

const LEGACY_PUBLIC_PATH_REWRITES = new Map<string, string>([
  ['/generation/inputs/extras/test-fire.mp4', '/assets/video/test-fire.mp4'],
])

const PUBLIC_FILE_REFERENCE_RE = /\/(?:assets|fonts)\/[^"'()\s<>]+/g

function isTextRewriteCandidate(absPath: string): boolean {
  return ['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt'].includes(path.extname(absPath))
}

function rewriteStandaloneTextAsset(text: string): string {
  let next = text
  for (const [from, to] of LEGACY_PUBLIC_PATH_REWRITES) {
    next = next.split(from).join(to)
  }
  return next
}

async function addFileToZip(
  zip: JSZip,
  absPath: string,
  zipPath: string,
  options: { rewriteText?: boolean } = {},
) {
  if (options.rewriteText && isTextRewriteCandidate(absPath)) {
    zip.file(zipPath, rewriteStandaloneTextAsset(await readFile(absPath, 'utf-8')))
    return
  }
  zip.file(zipPath, await readFile(absPath))
}

async function addDirToZip(
  zip: JSZip,
  absDir: string,
  zipDir: string,
  options: { rewriteText?: boolean } = {},
) {
  const entries = await readdir(absDir, { withFileTypes: true })
  for (const entry of entries) {
    const childAbs = path.join(absDir, entry.name)
    const childZip = zipDir ? `${zipDir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await addDirToZip(zip, childAbs, childZip, options)
    } else if (entry.isFile()) {
      await addFileToZip(zip, childAbs, childZip, options)
    }
  }
}

function rewriteAbsoluteToRelative(text: string): string {
  return text.replace(/(["'(])\/(assets|modules|fonts)\//g, '$1./$2/')
}

function rewriteRegistryPaths(raw: string): string {
  const reg = JSON.parse(raw) as Record<string, { file?: string; path?: string }>
  for (const entry of Object.values(reg)) {
    if (typeof entry.file === 'string' && entry.file.startsWith('/')) {
      entry.file = '.' + entry.file
    }
    if (typeof entry.path === 'string' && entry.path.startsWith('/')) {
      entry.path = '.' + entry.path
    }
  }
  return JSON.stringify(reg, null, 2)
}

function normalizePublicReference(value: string): string {
  return LEGACY_PUBLIC_PATH_REWRITES.get(value) ?? value
}

function collectPublicReferences(value: unknown, refs: Set<string>) {
  if (typeof value === 'string') {
    const normalized = normalizePublicReference(value)
    PUBLIC_FILE_REFERENCE_RE.lastIndex = 0
    for (const match of normalized.matchAll(PUBLIC_FILE_REFERENCE_RE)) refs.add(normalizePublicReference(match[0]))
    PUBLIC_FILE_REFERENCE_RE.lastIndex = 0
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPublicReferences(item, refs)
    return
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPublicReferences(item, refs)
  }
}

async function collectPublicReferencesFromDir(absDir: string, refs: Set<string>) {
  const entries = await readdir(absDir, { withFileTypes: true })
  for (const entry of entries) {
    const childAbs = path.join(absDir, entry.name)
    if (entry.isDirectory()) {
      await collectPublicReferencesFromDir(childAbs, refs)
    } else if (entry.isFile() && isTextRewriteCandidate(childAbs)) {
      collectPublicReferences(await readFile(childAbs, 'utf-8'), refs)
    }
  }
}

function publicFilePath(webPath: string): string {
  return webPath
    .replace(/^\//, '')
    .split('/')
    .map((part) => decodeURIComponent(part))
    .join('/')
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function scriptString(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function findSceneCss(projectDir: string, sceneId: string): string | null {
  for (const name of ['page.css', 'scene.css']) {
    const abs = path.join(projectDir, 'scenes', sceneId, name)
    if (existsSync(abs)) return abs
  }
  return null
}

function renderPageHtml(input: {
  project: ProjectManifest
  sceneId: string
  sceneName?: string
  scriptSrc: string
  assetPrefix: string
  hasSceneCss: boolean
}): string {
  const title = escapeHtml(input.sceneName ?? input.project.name)
  const cssLink = input.hasSceneCss ? '  <link rel="stylesheet" href="./scene.css" />\n' : ''
  const fontPrefix = input.assetPrefix
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    @font-face {
      font-family: 'FolkPro';
      src: url('${fontPrefix}fonts/FolkPro%20_Family/A-OTF-FolkPro-Regular.otf') format('opentype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'FolkPro';
      src: url('${fontPrefix}fonts/FolkPro%20_Family/A-OTF-FolkPro-Medium.otf') format('opentype');
      font-weight: 500;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'FolkPro';
      src: url('${fontPrefix}fonts/FolkPro%20_Family/A-OTF-FolkPro-Bold.otf') format('opentype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'FolkPro';
      src: url('${fontPrefix}fonts/FolkPro%20_Family/A-OTF-FolkPro-Heavy.otf') format('opentype');
      font-weight: 900;
      font-style: normal;
      font-display: swap;
    }
    </style>
  <link rel="icon" href="data:," />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body { background: #000; overflow: hidden; font-family: 'FolkPro', sans-serif; }
    #stage-wrap {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    #stage {
      width: 1440px;
      height: 1080px;
      position: relative;
      background: #000;
      transform-origin: center center;
      overflow: hidden;
    }
  </style>
${cssLink}</head>
<body>
  <div id="stage-wrap"><div id="stage"></div></div>
  <script>
    window.MELEE_INITIAL_SCENE = ${scriptString(input.sceneId)};
    window.MELEE_NAVIGATION_MODE = 'pages';
  </script>
  <script type="module" src="${escapeHtml(input.scriptSrc)}"></script>
</body>
</html>
`
}

async function addScenePageToZip(input: {
  zip: JSZip
  projectDir: string
  project: ProjectManifest
  sceneId: string
  sceneName?: string
  routeDir: string
}) {
  const { zip, projectDir, project, sceneId, sceneName, routeDir } = input
  const cssAbs = findSceneCss(projectDir, sceneId)
  if (cssAbs) {
    zip.file(`${routeDir}scene.css`, await readFile(cssAbs))
  }
  zip.file(
    `${routeDir}index.html`,
    renderPageHtml({
      project,
      sceneId,
      sceneName,
      scriptSrc: routeDir ? '../boot.js' : './boot.js',
      assetPrefix: routeDir ? '../' : './',
      hasSceneCss: Boolean(cssAbs),
    }),
  )
}

async function copyRendererToZip(zip: JSZip, absDir: string, zipDir: string) {
  const entries = await readdir(absDir, { withFileTypes: true })
  for (const entry of entries) {
    const childAbs = path.join(absDir, entry.name)
    const childZip = `${zipDir}/${entry.name}`
    if (entry.isDirectory()) {
      await copyRendererToZip(zip, childAbs, childZip)
    } else if (entry.isFile()) {
      const text = await readFile(childAbs, 'utf-8')
      zip.file(childZip, rewriteAbsoluteToRelative(text))
    }
  }
}

export async function POST(req: Request) {
  try {
    const selectedProjectId = new URL(req.url).searchParams.get('project')
    const project = loadProject(selectedProjectId)
    const selectedProjectRoot = projectRoot(selectedProjectId)
    if (!project) {
      return NextResponse.json({ error: 'project.json not found' }, { status: 400 })
    }
    if (!selectedProjectRoot) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!project.scenes.some((scene) => scene.id === project.entry)) {
      return NextResponse.json({ error: `project.entry '${project.entry}' is not listed in project.scenes` }, { status: 400 })
    }

    const zip = new JSZip()
    const appRoot = process.cwd()
    const projectDir = selectedProjectRoot
    const referencedPublicFiles = new Set<string>()

    zip.file('project.json', await readFile(path.join(projectDir, 'project.json')))

    const sceneNames = new Map<string, string | undefined>()
    for (const ref of project.scenes) {
      const sceneAbs = path.join(projectDir, 'scenes', ref.id, 'scene.json')
      const sceneRaw = await readFile(sceneAbs, 'utf-8')
      zip.file(`scenes/${ref.id}/scene.json`, sceneRaw)
      try {
        const scene = JSON.parse(sceneRaw) as { name?: string }
        collectPublicReferences(scene, referencedPublicFiles)
        sceneNames.set(ref.id, ref.name ?? scene.name)
      } catch {
        collectPublicReferences(sceneRaw, referencedPublicFiles)
        sceneNames.set(ref.id, ref.name)
      }
    }

    await copyRendererToZip(zip, path.join(appRoot, 'app/_engine/renderer'), 'renderer')

    zip.file('boot.js', await readFile(path.join(appRoot, 'app/_engine/export/boot.js')))

    await addScenePageToZip({
      zip,
      projectDir,
      project,
      sceneId: project.entry,
      sceneName: sceneNames.get(project.entry),
      routeDir: '',
    })
    for (const ref of project.scenes) {
      await addScenePageToZip({
        zip,
        projectDir,
        project,
        sceneId: ref.id,
        sceneName: sceneNames.get(ref.id),
        routeDir: `${ref.id}/`,
      })
    }

    const assetsRegRaw = await readFile(path.join(appRoot, 'public/assets/registry.json'), 'utf-8')
    const discoveredFonts = await discoverFontAssets(appRoot)
    zip.file('assets/registry.json', rewriteRegistryPaths(assetsRegRaw))
    zip.file('fonts/registry.json', rewriteRegistryPaths(JSON.stringify(discoveredFonts, null, 2)))
    const assetsReg = {
      ...JSON.parse(assetsRegRaw) as Record<string, { file: string }>,
      ...discoveredFonts,
    }
    const copiedAssetDirs = new Set<string>()
    for (const entry of Object.values(assetsReg)) {
      if (!entry.file?.startsWith('/')) continue
      const stripped = publicFilePath(entry.file)
      const containingDir = path.posix.dirname(stripped)
      if (containingDir.startsWith('assets/audio/')) {
        if (copiedAssetDirs.has(containingDir)) continue
        copiedAssetDirs.add(containingDir)
        await addDirToZip(zip, path.join(appRoot, 'public', containingDir), containingDir, { rewriteText: true })
      } else {
        await addFileToZip(zip, path.join(appRoot, 'public', stripped), stripped, { rewriteText: true })
      }
    }

    const modulesRegRaw = await readFile(path.join(appRoot, 'public/modules/registry.json'), 'utf-8')
    zip.file('modules/registry.json', rewriteRegistryPaths(modulesRegRaw))
    collectPublicReferences(modulesRegRaw, referencedPublicFiles)
    const modulesReg = JSON.parse(modulesRegRaw) as Record<string, { path: string }>
    const copiedModuleDirs = new Set<string>()
    for (const entry of Object.values(modulesReg)) {
      if (!entry.path?.startsWith('/')) continue
      const stripped = publicFilePath(entry.path)
      const containingDir = path.posix.dirname(stripped)
      if (copiedModuleDirs.has(containingDir)) continue
      copiedModuleDirs.add(containingDir)
      const moduleDir = path.join(appRoot, 'public', containingDir)
      await collectPublicReferencesFromDir(moduleDir, referencedPublicFiles)
      await addDirToZip(zip, moduleDir, containingDir, { rewriteText: true })
    }

    await addDirToZip(zip, path.join(appRoot, 'public/fonts'), 'fonts')

    for (const ref of referencedPublicFiles) {
      const stripped = publicFilePath(ref)
      const abs = path.join(appRoot, 'public', stripped)
      if (!existsSync(abs)) continue
      const info = await stat(abs)
      if (info.isDirectory()) {
        await addDirToZip(zip, abs, stripped, { rewriteText: true })
      } else if (info.isFile()) {
        await addFileToZip(zip, abs, stripped, { rewriteText: true })
      }
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.id}.zip"`,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    )
  }
}
