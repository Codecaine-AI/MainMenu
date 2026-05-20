'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSceneLoader } from '@/hooks/useSceneLoader'
import { CanvasPanel } from './_components/CanvasPanel'
import { HierarchyPanel } from './_components/HierarchyPanel'
import { InspectorPanel } from './_components/InspectorPanel'

function EditorContent() {
  const params = useSearchParams()
  const projectId = params.get('project')
  const sceneId = params.get('scene') ?? 'title'
  const { loading, error } = useSceneLoader(projectId, sceneId)
  const scenesHref = projectId ? `/projects/${encodeURIComponent(projectId)}` : '/'

  return (
    <div className="editor-shell overflow-hidden bg-[#111] text-gray-300">
      {loading ? (
        <>
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
        <section className="bg-[#1a1a1a] p-4 col-span-3 row-span-2">
          <p className="text-red-400 text-sm">{error}</p>
        </section>
      ) : (
        <>
          <HierarchyPanel projectId={projectId} sceneId={sceneId} scenesHref={scenesHref} />
          <CanvasPanel />
          <InspectorPanel />
        </>
      )}
    </div>
  )
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#111] grid place-items-center text-gray-500 text-sm">Loading editor...</div>}>
      <EditorContent />
    </Suspense>
  )
}
