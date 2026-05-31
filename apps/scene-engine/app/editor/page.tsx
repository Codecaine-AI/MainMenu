'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSceneLoader } from '@/hooks/useSceneLoader'
import { CanvasPanel } from './_components/CanvasPanel'
import { HierarchyPanel } from './_components/HierarchyPanel'
import { InspectorPanel } from './_components/InspectorPanel'
import { EditorTopBar } from './_features/desktop-menu/EditorTopBar'
import { useDesktopMenuCommands } from './_features/desktop-menu/useDesktopMenuCommands'

function EditorContent() {
  const params = useSearchParams()
  const projectId = params.get('project')
  const sceneId = params.get('scene') ?? 'title'
  const { loading, error } = useSceneLoader(projectId, sceneId)
  useDesktopMenuCommands({ projectId, sceneId })

  return (
    <div className="editor-shell overflow-hidden bg-[#111] text-gray-300">
      {loading ? (
        <>
          <EditorTopBar projectId={projectId} sceneId={sceneId} />
          <section className="bg-[#1a1a1a] overflow-auto p-2" style={{ gridArea: 'hierarchy' }}>
            <p className="text-gray-600 text-xs italic">Loading...</p>
          </section>
          <section className="bg-black grid place-items-center" style={{ gridArea: 'canvas' }}>
            <p className="text-gray-600 text-xs italic">Loading scene...</p>
          </section>
          <section className="bg-[#1a1a1a] overflow-auto p-2" style={{ gridArea: 'inspector' }}>
            <p className="text-gray-600 text-xs italic">Loading...</p>
          </section>
        </>
      ) : error ? (
        <>
          <EditorTopBar projectId={projectId} sceneId={sceneId} />
          <section className="bg-[#1a1a1a] p-4" style={{ gridColumn: '1 / -1', gridRow: 2 }}>
            <p className="text-red-400 text-sm">{error}</p>
          </section>
        </>
      ) : (
        <>
          <EditorTopBar projectId={projectId} sceneId={sceneId} />
          <HierarchyPanel projectId={projectId} sceneId={sceneId} />
          <CanvasPanel />
          <InspectorPanel />
        </>
      )}
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[100dvh] place-items-center bg-[#111] text-sm text-gray-500">Loading editor...</div>}>
      <EditorContent />
    </Suspense>
  )
}
