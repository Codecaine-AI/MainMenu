'use client'

import { useEditorStore } from '@/store/editor-store'
import { resolveObject } from '@/lib/path'
import type { SceneJson } from '@/types/scene'
import { LayerForm } from './LayerForm'
import { SceneSettingsSection } from './SceneSection'

export function InspectorPanel() {
  const scene = useEditorStore((s) => s.scene)
  const selectedPath = useEditorStore((s) => s.selectedPath)

  let content: React.ReactNode
  if (!scene) {
    content = <p className="text-gray-600 text-[11px] italic px-1 py-2">Loading scene...</p>
  } else if (!selectedPath) {
    content = <p className="text-gray-600 text-[11px] italic px-1 py-2">Select a layer to inspect.</p>
  } else {
    const layer = resolveObject(scene as SceneJson, selectedPath)
    if (!layer) {
      content = <p className="text-gray-600 text-[11px] italic px-1 py-2">Selected path no longer resolves.</p>
    } else {
      content = <LayerForm key={selectedPath} layer={layer} path={selectedPath} />
    }
  }

  return (
    <section className="bg-[#1e1e1e] overflow-auto p-2 pr-3" style={{ gridArea: 'inspector' }}>
      <h3 className="text-[13px] uppercase tracking-wide text-gray-100 font-bold mb-2">
        Inspector
      </h3>
      <SceneSettingsSection />
      {content}
    </section>
  )
}
