'use client'

import Link from 'next/link'
import { useEditorStore } from '@/store/editor-store'
import type { SceneJson } from '@/types/scene'

interface Props {
  projectId: string | null
  sceneId: string
}

function displayProject(projectId: string | null) {
  if (!projectId) return 'Project'
  return projectId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function EditorTopBar({ projectId, sceneId }: Props) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const dirty = useEditorStore((s) => s.dirty)
  const sceneName = scene?.name ?? sceneId
  const projectLabel = displayProject(projectId)
  const projectHref = projectId ? `/projects/${encodeURIComponent(projectId)}` : '/'

  return (
    <header
      className="flex min-w-0 items-center justify-between gap-3 border-b border-[#2c2c2c] bg-[#171717] px-3 font-mono text-[11px]"
      style={{ gridArea: 'topbar' }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-gray-100">Main Menu</span>
        <span className="text-gray-700">/</span>
        <Link
          href={projectHref}
          className="shrink-0 rounded-sm px-1 py-0.5 text-gray-400 no-underline hover:bg-[#232323] hover:text-gray-100 active:translate-y-px"
        >
          {projectLabel}
        </Link>
        <span className="text-gray-700">/</span>
        <span className="min-w-0 truncate text-gray-300">{sceneName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full border ${
            dirty
              ? 'border-[#d6b744] bg-[#d6b744] shadow-[0_0_0_2px_rgba(214,183,68,0.14)]'
              : 'border-[#4c5c50] bg-transparent'
          }`}
        />
        <span className={`uppercase tracking-wide ${dirty ? 'text-[#d6c783]' : 'text-gray-600'}`}>
          {dirty ? 'Unsaved changes' : 'Saved'}
        </span>
      </div>
    </header>
  )
}
