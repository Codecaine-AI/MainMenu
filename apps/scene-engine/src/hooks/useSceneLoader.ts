'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'

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
      const { loadRegistry, getRegistry } = await import('@/renderer/asset-registry')
      await loadRegistry()
      setRegistry(getRegistry())

      const res = await fetch(`/api/scenes/${sceneId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load scene '${sceneId}': ${res.status}`)
      const scene = await res.json()

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
