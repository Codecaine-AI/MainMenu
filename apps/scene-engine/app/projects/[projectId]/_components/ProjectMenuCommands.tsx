'use client'

import { useEffect } from 'react'
import type { MainMenuCommandEvent } from '../../../../desktop/types/main-menu'
import { deployProject, exportProject } from './projectActions'

export function ProjectMenuCommands({ projectId }: { projectId: string }) {
  useEffect(() => {
    const bridge = window.mainMenu?.app
    if (!bridge?.onCommand) return

    function handleCommand(event: MainMenuCommandEvent) {
      if (event.command === 'export-project') {
        void exportProject(projectId).catch((err) => {
          alert(err instanceof Error ? err.message : 'Export failed')
        })
      } else if (event.command === 'deploy-project') {
        void deployProject(projectId).catch((err) => {
          alert(err instanceof Error ? err.message : 'Deploy failed')
        })
      } else if (event.command === 'open-project') {
        window.location.href = `/projects/${encodeURIComponent(projectId)}`
      }
    }

    return bridge.onCommand(handleCommand)
  }, [projectId])

  return null
}
