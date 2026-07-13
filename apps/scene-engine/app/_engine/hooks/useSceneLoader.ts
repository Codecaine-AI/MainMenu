'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { loadComponentSchema } from '@/lib/component-schema-loader'
import type { SceneJson, SceneObject } from '@/types/scene'

function collectComponentAssetIds(scene: SceneJson): string[] {
  const ids = new Set<string>()
  function walk(layers: SceneObject[] | undefined) {
    if (!Array.isArray(layers)) return
    for (const layer of layers) {
      if (layer.type === 'component' && typeof layer.asset === 'string') {
        ids.add(layer.asset)
      }
      if (Array.isArray(layer.children)) walk(layer.children)
    }
  }
  walk(scene.objects)
  return Array.from(ids)
}

export function useSceneLoader(projectId: string | null, sceneId: string) {
  const { setProjectContext, setProject, setScene, setRegistry, setComponentSchema, markClean } = useEditorStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadCount = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const thisLoad = ++loadCount.current
    setProject(null)
    try {
      const { loadRegistry, getRegistry } = await import('@/renderer/asset-registry')
      if (projectId) (window as typeof window & { MELEE_PROJECT_ID?: string }).MELEE_PROJECT_ID = projectId
      const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
      const projectPromise = projectId
        ? fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: 'no-store' })
            .then((response) => response.ok ? response.json() : null)
            .catch(() => null)
        : Promise.resolve(null)
      const scenePromise = fetch(`/api/scenes/${sceneId}${projectQuery}`, { cache: 'no-store' })

      const [, res, project] = await Promise.all([
        loadRegistry({ projectId }),
        scenePromise,
        projectPromise,
      ])
      setRegistry(getRegistry())
      if (!res.ok) throw new Error(`Failed to load scene '${sceneId}': ${res.status}`)
      const scene = await res.json()

      if (thisLoad === loadCount.current) {
        setProjectContext(projectId, sceneId)
        setProject(project)
        setScene(scene)
        markClean()

        const reg = getRegistry()
        const ids = collectComponentAssetIds(scene)
        for (const id of ids) {
          const entry = reg?.[id]
          if (
            entry &&
            (entry as { type?: string }).type === 'component' &&
            typeof (entry as { path?: string }).path === 'string'
          ) {
            loadComponentSchema((entry as { path: string }).path).then((schema) => {
              if (thisLoad === loadCount.current) setComponentSchema(id, schema)
            })
          }
        }
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
  }, [projectId, sceneId, setProjectContext, setProject, setScene, setRegistry, setComponentSchema, markClean])

  useEffect(() => { load() }, [load])

  return { loading, error, reload: load }
}
