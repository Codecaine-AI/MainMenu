'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

export default function ScenePage() {
  const params = useParams<{ id: string }>()
  const stageRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const [{ renderScene }, { loadRegistry }] = await Promise.all([
        import('@/renderer/scene-renderer'),
        import('@/renderer/asset-registry'),
      ])
      await loadRegistry()
      const res = await fetch(`/api/scenes/${params.id}`)
      if (!res.ok) return
      const scene = await res.json()
      if (!cancelled && stageRef.current) {
        await renderScene(scene, stageRef.current)
      }
    }
    run().catch(console.error)
    return () => { cancelled = true }
  }, [params.id])

  const fitStage = useCallback(() => {
    if (!wrapRef.current || !stageRef.current) return
    const { clientWidth: w, clientHeight: h } = wrapRef.current
    const scale = Math.min(w / 1440, h / 1080)
    stageRef.current.style.transform = `scale(${scale})`
  }, [])

  useEffect(() => {
    if (!wrapRef.current) return
    const obs = new ResizeObserver(fitStage)
    obs.observe(wrapRef.current)
    fitStage()
    return () => obs.disconnect()
  }, [fitStage])

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-black grid place-items-center overflow-hidden"
    >
      <div
        ref={stageRef}
        style={{
          width: 1440,
          height: 1080,
          position: 'relative',
          transformOrigin: 'center center',
          background: '#000',
          overflow: 'hidden',
        }}
      />
    </div>
  )
}
