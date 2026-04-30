'use client'

import { useEditorStore } from '@/store/editor-store'
import { resolveObject } from '@/lib/path'
import type { SceneJson } from '@/types/scene'
import { SubLayerForm } from './SubLayerForm'
import { MediaChildForm } from './MediaChildForm'
import { LayerForm } from './LayerForm'

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
    } else if (layer.layer) {
      content = <SubLayerForm key={selectedPath} layer={layer} path={selectedPath} />
    } else if (!layer.transform && layer.type === 'media') {
      content = <MediaChildForm key={selectedPath} layer={layer} path={selectedPath} />
    } else {
      content = <LayerForm key={selectedPath} layer={layer} path={selectedPath} />
    }
  }

  return (
    <section className="bg-[#1e1e1e] overflow-auto p-2 pr-3" style={{ gridArea: 'inspector' }}>
      <h3 className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-2">
        Inspector
      </h3>
      {content}
    </section>
  )
}
