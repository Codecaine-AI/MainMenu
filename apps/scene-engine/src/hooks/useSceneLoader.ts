'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'

async function expandGlyphGroupChildren(
  scene: Record<string, unknown>,
  resolveAsset: (id: string) => { file: string } | undefined,
  discoverGlyphLayers: (path: string) => Promise<(string | null)[]>,
) {
  const layers = scene.layers as Record<string, unknown>[]
  if (!layers) return

  for (const layer of layers) {
    if (layer.type !== 'glyph-group') continue
    const entry = resolveAsset(layer.asset as string)
    if (!entry) continue

    const rawLayers = await discoverGlyphLayers(entry.file)
    const svgLayers = rawLayers.filter((l): l is string => l != null)
    const existing = (layer.children ?? []) as Record<string, unknown>[]
    const overrideMap = new Map<string, Record<string, unknown>>()
    for (const child of existing) {
      if (child.layer) overrideMap.set(child.layer as string, child)
    }

    const foreignByAnchor = new Map<string, Record<string, unknown>[]>()
    let prevNamedLayer: string | null = null
    for (const child of existing) {
      if (child.layer) {
        prevNamedLayer = child.layer as string
      } else if (child.type) {
        const key = prevNamedLayer ?? ''
        if (!foreignByAnchor.has(key)) foreignByAnchor.set(key, [])
        foreignByAnchor.get(key)!.push(child)
      }
    }

    const merged: Record<string, unknown>[] = []
    const preForeign = foreignByAnchor.get('') ?? []
    for (const fc of preForeign) merged.push(fc)

    for (const svgLayer of svgLayers) {
      if (overrideMap.has(svgLayer)) {
        merged.push(overrideMap.get(svgLayer)!)
      } else {
        merged.push({ id: svgLayer, layer: svgLayer, visible: true })
      }
      const anchored = foreignByAnchor.get(svgLayer) ?? []
      for (const fc of anchored) merged.push(fc)
    }

    layer.children = merged
  }
}

export function useSceneLoader(sceneId: string) {
  const { setScene, setRegistry, markClean } = useEditorStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadCount = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const thisLoad = ++loadCount.current
    try {
      const [{ loadRegistry, getRegistry, resolveAsset }, { discoverGlyphLayers }] =
        await Promise.all([
          import('@/renderer/asset-registry'),
          import('@/renderer/asset-renderers/glyph-group'),
        ])
      await loadRegistry()
      setRegistry(getRegistry())

      const res = await fetch(`/api/scenes/${sceneId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load scene '${sceneId}': ${res.status}`)
      const scene = await res.json()
      await expandGlyphGroupChildren(scene, resolveAsset, discoverGlyphLayers)

      if (thisLoad === loadCount.current) {
        setScene(scene)
        markClean()
      }
    } catch (err) {
      if (thisLoad === loadCount.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (thisLoad === loadCount.current) {
        setLoading(false)
      }
    }
  }, [sceneId, setScene, setRegistry, markClean])

  useEffect(() => { load() }, [load])

  return { loading, error, reload: load }
}
