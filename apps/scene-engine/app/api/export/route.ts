import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { loadProject } from '@/lib/scenes'
import { discoverFontAssets } from '@/lib/font-discovery'

async function addFileToZip(zip: JSZip, absPath: string, zipPath: string) {
  const buf = await readFile(absPath)
  zip.file(zipPath, buf)
}

async function addDirToZip(zip: JSZip, absDir: string, zipDir: string) {
  const entries = await readdir(absDir, { withFileTypes: true })
  for (const entry of entries) {
    const childAbs = path.join(absDir, entry.name)
    const childZip = zipDir ? `${zipDir}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await addDirToZip(zip, childAbs, childZip)
    } else if (entry.isFile()) {
      await addFileToZip(zip, childAbs, childZip)
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

export async function POST() {
  try {
    const project = loadProject()
    if (!project) {
      return NextResponse.json({ error: 'project.json not found' }, { status: 400 })
    }

    const zip = new JSZip()
    const root = process.cwd()

    zip.file('project.json', await readFile(path.join(root, 'project.json')))

    for (const ref of project.scenes) {
      const sceneAbs = path.join(root, 'scenes', ref.id, 'scene.json')
      zip.file(`scenes/${ref.id}/scene.json`, await readFile(sceneAbs))
    }

    await copyRendererToZip(zip, path.join(root, 'src/renderer'), 'renderer')

    zip.file('index.html', await readFile(path.join(root, 'src/export/index.html')))
    zip.file('boot.js', await readFile(path.join(root, 'src/export/boot.js')))

    const assetsRegRaw = await readFile(path.join(root, 'public/assets/registry.json'), 'utf-8')
    const discoveredFonts = await discoverFontAssets(root)
    zip.file('assets/registry.json', rewriteRegistryPaths(assetsRegRaw))
    zip.file('fonts/registry.json', rewriteRegistryPaths(JSON.stringify(discoveredFonts, null, 2)))
    const assetsReg = {
      ...JSON.parse(assetsRegRaw) as Record<string, { file: string }>,
      ...discoveredFonts,
    }
    const copiedAssetDirs = new Set<string>()
    for (const entry of Object.values(assetsReg)) {
      if (!entry.file?.startsWith('/')) continue
      const stripped = entry.file.replace(/^\//, '')
      const containingDir = path.posix.dirname(stripped)
      if (containingDir.startsWith('assets/audio/')) {
        if (copiedAssetDirs.has(containingDir)) continue
        copiedAssetDirs.add(containingDir)
        await addDirToZip(zip, path.join(root, 'public', containingDir), containingDir)
      } else {
        await addFileToZip(zip, path.join(root, 'public', stripped), stripped)
      }
    }

    const modulesRegRaw = await readFile(path.join(root, 'public/modules/registry.json'), 'utf-8')
    zip.file('modules/registry.json', rewriteRegistryPaths(modulesRegRaw))
    const modulesReg = JSON.parse(modulesRegRaw) as Record<string, { path: string }>
    const copiedModuleDirs = new Set<string>()
    for (const entry of Object.values(modulesReg)) {
      if (!entry.path?.startsWith('/')) continue
      const stripped = entry.path.replace(/^\//, '')
      const containingDir = path.posix.dirname(stripped)
      if (copiedModuleDirs.has(containingDir)) continue
      copiedModuleDirs.add(containingDir)
      await addDirToZip(zip, path.join(root, 'public', containingDir), containingDir)
    }

    await addDirToZip(zip, path.join(root, 'public/fonts'), 'fonts')

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
