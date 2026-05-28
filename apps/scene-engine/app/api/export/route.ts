import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { loadProject, projectRoot } from '@/lib/scenes'
import { discoverProjectFontAssets } from '@/lib/font-discovery'
import { collectExportGraph, moduleDirectoryForEntry } from '@/lib/export-reachability'
import { resolveProjectPaths, type ProjectPaths } from '@/lib/project-paths'
import type { AssetContainer, ModuleEntry, ProjectManifest } from '@/types/scene'

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

function rewriteRegistryObject(registry: Record<string, { file?: string; path?: string }>): string {
  return rewriteRegistryPaths(JSON.stringify(registry, null, 2))
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

function findSceneCss(projectPaths: ProjectPaths, sceneId: string): string | null {
  const sceneDir = projectPaths.sceneDir(sceneId)
  for (const name of ['page.css', 'scene.css']) {
    const abs = path.join(sceneDir, name)
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
  projectPaths: ProjectPaths
  project: ProjectManifest
  sceneId: string
  sceneName?: string
  routeDir: string
}) {
  const { zip, projectPaths, project, sceneId, sceneName, routeDir } = input
  const cssAbs = findSceneCss(projectPaths, sceneId)
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
    const selectedProjectPaths = resolveProjectPaths(selectedProjectId)
    if (!project) {
      return NextResponse.json({ error: 'project.json not found' }, { status: 400 })
    }
    if (!selectedProjectRoot || !selectedProjectPaths) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!project.scenes.some((scene) => scene.id === project.entry)) {
      return NextResponse.json({ error: `project.entry '${project.entry}' is not listed in project.scenes` }, { status: 400 })
    }
    const activeSceneRefs = project.scenes.filter((scene) => scene.active !== false && scene.export !== false)
    if (!activeSceneRefs.some((scene) => scene.id === project.entry)) {
      return NextResponse.json({ error: `project.entry '${project.entry}' is not active for export` }, { status: 400 })
    }

    const zip = new JSZip()
    const appRoot = process.cwd()
    const projectDir = selectedProjectRoot
    const assetsRegRaw = existsSync(selectedProjectPaths.assetRegistryFile)
      ? await readFile(selectedProjectPaths.assetRegistryFile, 'utf-8')
      : '{}'
    const modulesRegRaw = existsSync(selectedProjectPaths.moduleRegistryFile)
      ? await readFile(selectedProjectPaths.moduleRegistryFile, 'utf-8')
      : '{}'
    const discoveredFonts = await discoverProjectFontAssets(project.id, { urlMode: 'logical' })
    const assetsReg = JSON.parse(assetsRegRaw) as Record<string, AssetContainer>
    const modulesReg = JSON.parse(modulesRegRaw) as Record<string, ModuleEntry>
    const exportedProject: ProjectManifest = { ...project, scenes: activeSceneRefs }
    const graph = await collectExportGraph({
      appRoot,
      projectDir,
      projectPaths: selectedProjectPaths,
      project: exportedProject,
      assetsRegistry: assetsReg,
      modulesRegistry: modulesReg,
      fontsRegistry: discoveredFonts,
    })

    zip.file('project.json', JSON.stringify(exportedProject, null, 2) + '\n')

    const sceneNames = new Map<string, string | undefined>()
    for (const sceneFile of graph.scenes) {
      zip.file(`scenes/${sceneFile.id}/scene.json`, sceneFile.raw)
      sceneNames.set(sceneFile.id, sceneFile.name)
    }

    await copyRendererToZip(zip, path.join(appRoot, 'app/_engine/renderer'), 'renderer')

    zip.file('boot.js', await readFile(path.join(appRoot, 'app/_engine/export/boot.js')))
    zip.file('Makefile', await readFile(path.join(appRoot, 'app/_engine/export/Makefile'), 'utf-8'))
    zip.file('server.mjs', await readFile(path.join(appRoot, 'app/_engine/export/server.mjs'), 'utf-8'))

    await addScenePageToZip({
      zip,
      projectPaths: selectedProjectPaths,
      project: exportedProject,
      sceneId: exportedProject.entry,
      sceneName: sceneNames.get(exportedProject.entry),
      routeDir: '',
    })
    for (const ref of exportedProject.scenes) {
      await addScenePageToZip({
        zip,
        projectPaths: selectedProjectPaths,
        project: exportedProject,
        sceneId: ref.id,
        sceneName: sceneNames.get(ref.id),
        routeDir: `${ref.id}/`,
      })
    }

    zip.file('assets/registry.json', rewriteRegistryObject(graph.assetsRegistry))
    zip.file('fonts/registry.json', rewriteRegistryObject(graph.fontsRegistry))
    const copiedAssetDirs = new Set<string>()
    for (const entry of Object.values(graph.assetsRegistry)) {
      if (!entry.file?.startsWith('/')) continue
      const stripped = publicFilePath(entry.file)
      const containingDir = path.posix.dirname(stripped)
      if (containingDir.startsWith('assets/audio/')) {
        if (copiedAssetDirs.has(containingDir)) continue
        copiedAssetDirs.add(containingDir)
        const sourceDir = selectedProjectPaths.resolveLogicalFile(`/${containingDir}`)
        if (sourceDir) await addDirToZip(zip, sourceDir, containingDir, { rewriteText: true })
      } else {
        const sourceFile = selectedProjectPaths.resolveLogicalFile(entry.file)
        if (sourceFile) await addFileToZip(zip, sourceFile, stripped, { rewriteText: true })
      }
    }

    zip.file('modules/registry.json', rewriteRegistryObject(graph.modulesRegistry))
    const copiedModuleDirs = new Set<string>()
    for (const entry of Object.values(graph.modulesRegistry)) {
      const containingDir = moduleDirectoryForEntry(entry)
      if (!containingDir) continue
      if (copiedModuleDirs.has(containingDir)) continue
      copiedModuleDirs.add(containingDir)
      const moduleDir = selectedProjectPaths.resolveLogicalFile(`/${containingDir}`)
      if (moduleDir) await addDirToZip(zip, moduleDir, containingDir, { rewriteText: true })
    }

    for (const entry of Object.values(graph.fontsRegistry)) {
      if (!entry.file?.startsWith('/')) continue
      const stripped = publicFilePath(entry.file)
      const sourceFile = selectedProjectPaths.resolveLogicalFile(entry.file)
      if (sourceFile) await addFileToZip(zip, sourceFile, stripped, { rewriteText: true })
    }

    for (const ref of graph.publicFiles) {
      const stripped = publicFilePath(ref)
      const abs = selectedProjectPaths.resolveLogicalFile(ref)
      if (!abs || !existsSync(abs)) continue
      const info = await stat(abs)
      if (info.isDirectory()) {
        await addDirToZip(zip, abs, stripped, { rewriteText: true })
      } else if (info.isFile()) {
        await addFileToZip(zip, abs, stripped, { rewriteText: true })
      }
    }

    zip.file('export-graph.json', JSON.stringify({
      projectId: graph.projectId,
      activeSceneIds: graph.activeSceneIds,
      assetIds: graph.assetIds,
      moduleIds: graph.moduleIds,
      fontIds: graph.fontIds,
      publicFiles: graph.publicFiles,
      warnings: graph.warnings,
      excludedAssetIds: graph.excludedAssetIds,
      excludedModuleIds: graph.excludedModuleIds,
      excludedFontIds: graph.excludedFontIds,
    }, null, 2) + '\n')

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
