'use client'

import { Suspense, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

function SceneContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project')
  const returnTo = searchParams.get('returnTo')
  const router = useRouter()
  const stageRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const projectQuery = projectId ? `?project=${encodeURIComponent(projectId)}` : ''
  const safeReturnTo = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : null
  const sceneParams = new URLSearchParams()
  if (projectId) sceneParams.set('project', projectId)
  if (safeReturnTo) sceneParams.set('returnTo', safeReturnTo)
  const sceneQuery = sceneParams.toString() ? `?${sceneParams.toString()}` : ''

  const exitPreview = useCallback(() => {
    if (safeReturnTo) {
      router.push(safeReturnTo)
      return
    }
    if (projectId) {
      router.push(`/projects/${encodeURIComponent(projectId)}`)
      return
    }
    router.push('/')
  }, [projectId, safeReturnTo, router])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const [{ renderScene }, { loadRegistry }] = await Promise.all([
        import('@/renderer/scene-renderer'),
        import('@/renderer/asset-registry'),
      ])
      if (projectId) (window as typeof window & { MELEE_PROJECT_ID?: string }).MELEE_PROJECT_ID = projectId
      await loadRegistry({ projectId })
      const res = await fetch(`/api/scenes/${params.id}${projectQuery}`)
      if (!res.ok) return
      const scene = await res.json()
      if (!cancelled && stageRef.current) {
        await renderScene(scene, stageRef.current, {
          projectId,
          runtime: {
            projectId,
            navigate: (sceneId: string) => router.push(`/scenes/${sceneId}${sceneQuery}`),
          },
        })
      }
    }
    run().catch(console.error)
    return () => { cancelled = true }
  }, [params.id, projectQuery, router, sceneQuery])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') exitPreview()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [exitPreview])

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
      className="fixed inset-0 bg-[#050505] grid place-items-center overflow-hidden"
    >
      <button
        type="button"
        onClick={exitPreview}
        className="fixed left-4 top-4 z-20 rounded-sm border border-white/15 bg-[#151515]/85 px-3 py-1.5 text-xs font-medium text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition hover:bg-[#202020]/90 active:translate-y-px"
        aria-label="Exit preview"
      >
        Exit Preview
      </button>
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

export default function ScenePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <SceneContent />
    </Suspense>
  )
}
