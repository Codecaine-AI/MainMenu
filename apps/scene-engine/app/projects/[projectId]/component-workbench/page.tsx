import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { resolveProjectPaths } from '@/lib/project-paths'
import { loadProject } from '@/lib/scenes'
import type { ModuleEntry } from '@/types/scene'

interface ComponentRecord extends ModuleEntry {
  id: string
  label: string
}

function labelFromId(id: string) {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function listComponentModules(projectId: string): ComponentRecord[] {
  const paths = resolveProjectPaths(projectId)
  if (!paths || !existsSync(paths.moduleRegistryFile)) return []

  const registry = JSON.parse(readFileSync(paths.moduleRegistryFile, 'utf-8')) as Record<string, ModuleEntry>
  return Object.entries(registry)
    .filter(([, entry]) => entry.type === 'component')
    .map(([id, entry]) => ({
      ...entry,
      id,
      label: labelFromId(id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}

function moduleDir(entry: ModuleEntry) {
  const modulePath = 'path' in entry ? entry.path : ''
  if (!modulePath) return ''
  return path.posix.dirname(modulePath)
}

export default async function ComponentWorkbenchPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = loadProject(projectId)
  if (!project) notFound()

  const components = listComponentModules(projectId)

  return (
    <main className="min-h-[100dvh] bg-[#111] px-6 py-7 text-gray-300">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[#2a2a2a] pb-5">
          <div>
            <Link
              href={`/projects/${encodeURIComponent(projectId)}`}
              className="mb-2 block text-xs text-gray-500 no-underline hover:text-gray-300"
            >
              Project
            </Link>
            <h1 className="text-2xl font-semibold tracking-wide text-gray-100">Component Workbench</h1>
            <p className="mt-1 text-sm text-gray-500">
              Build reusable UI units between atomic assets and full scenes.
            </p>
          </div>
          <Link
            href={`/editor?project=${encodeURIComponent(projectId)}&scene=${encodeURIComponent(project.entry)}`}
            className="rounded-sm border border-[#444] bg-[#202020] px-3 py-1.5 text-xs text-gray-200 no-underline hover:bg-[#2a2a2a] active:translate-y-px"
          >
            Scene Editor
          </Link>
        </header>

        <div className="mb-7 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="border-y border-[#242424] py-4">
            <p className="m-0 font-mono text-[11px] uppercase tracking-wide text-gray-500">Input</p>
            <p className="mt-2 text-sm font-medium text-gray-100">Project Assets</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">Images, glyphs, type, audio, and published SVG/CSS assets.</p>
          </div>
          <div className="border-y border-[#242424] py-4">
            <p className="m-0 font-mono text-[11px] uppercase tracking-wide text-gray-500">Workbench</p>
            <p className="mt-2 text-sm font-medium text-gray-100">Reusable Component</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">Layout, states, variants, properties, and interaction bindings.</p>
          </div>
          <div className="border-y border-[#242424] py-4">
            <p className="m-0 font-mono text-[11px] uppercase tracking-wide text-gray-500">Output</p>
            <p className="mt-2 text-sm font-medium text-gray-100">Scene-Ready Unit</p>
            <p className="mt-1 text-sm leading-6 text-gray-500">Menu items, panels, selectors, lockups, and grouped controls.</p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Component Modules</h2>
          {components.length === 0 ? (
            <div className="border-y border-[#242424] py-8 text-sm text-gray-500">
              No component modules are registered for this project yet.
            </div>
          ) : (
            <div className="divide-y divide-[#242424] border-y border-[#242424]">
              {components.map((component) => (
                <div
                  key={component.id}
                  className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-medium text-gray-100">{component.label}</p>
                    <p className="mt-1 truncate font-mono text-xs text-gray-600">{component.id}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-gray-600">{moduleDir(component)}</p>
                  </div>
                  <span className="rounded-sm border border-[#333] bg-[#222] px-2.5 py-1 text-xs text-gray-200">
                    Component
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
