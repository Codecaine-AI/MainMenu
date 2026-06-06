'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import type { SceneJson } from '@/types/scene'
import type { MainMenuCommandEvent } from '../../../../desktop/types/main-menu'
import { deployProject, exportProject, saveScene } from './sceneActions'

interface Input {
  projectId: string | null
  sceneId: string
}

export function useDesktopMenuCommands({ projectId, sceneId }: Input) {
  const scene = useEditorStore((s) => s.scene) as SceneJson | null
  const dirty = useEditorStore((s) => s.dirty)
  const markClean = useEditorStore((s) => s.markClean)
  const savingRef = useRef(false)

  const saveActiveScene = useCallback(async () => {
    if (!scene || savingRef.current) return
    savingRef.current = true
    try {
      await saveScene({ projectId, sceneId, scene })
      markClean()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
      throw err
    } finally {
      savingRef.current = false
    }
  }, [markClean, projectId, scene, sceneId])

  const exportActiveProject = useCallback(async () => {
    try {
      await exportProject(projectId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    }
  }, [projectId])

  const deployActiveProject = useCallback(async () => {
    try {
      await deployProject(projectId)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Deploy failed')
    }
  }, [projectId])

  const navigateFromEditor = useCallback(
    async (href: string) => {
      if (!dirty) {
        window.location.href = href
        return
      }

      if (window.confirm('Save scene changes before leaving?')) {
        try {
          await saveActiveScene()
        } catch {
          return
        }
        window.location.href = href
        return
      }

      if (window.confirm('Leave without saving?')) {
        window.location.href = href
      }
    },
    [dirty, saveActiveScene],
  )

  useEffect(() => {
    const bridge = window.mainMenu?.app
    if (!bridge?.onCommand) return

    function handleCommand(event: MainMenuCommandEvent) {
      if (event.command === 'save-scene') {
        if (!dirty) return
        void saveActiveScene()
      } else if (event.command === 'export-project') {
        void exportActiveProject()
      } else if (event.command === 'deploy-project') {
        void deployActiveProject()
      } else if (event.command === 'open-project') {
        void navigateFromEditor(projectId ? `/projects/${encodeURIComponent(projectId)}` : '/')
      }
    }

    return bridge.onCommand(handleCommand)
  }, [deployActiveProject, dirty, exportActiveProject, navigateFromEditor, projectId, saveActiveScene])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      if (event.key.toLowerCase() !== 's') return
      if (!event.metaKey && !event.ctrlKey) return
      if (event.altKey) return

      event.preventDefault()
      if (dirty) void saveActiveScene()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dirty, saveActiveScene])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!dirty || event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target instanceof Element ? event.target : null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      const currentUrl = new URL(window.location.href)
      const isSamePage = nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search
      if (nextUrl.href === currentUrl.href || (isSamePage && nextUrl.hash !== currentUrl.hash)) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      void navigateFromEditor(nextUrl.href)
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [dirty, navigateFromEditor])
}
