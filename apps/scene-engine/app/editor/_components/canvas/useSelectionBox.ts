import { useLayoutEffect, useState } from 'react'
import { resolveObjectEl } from '@/lib/path'
import type { SceneJson } from '@/types/scene'

export interface SelectionBox {
  left: number
  top: number
  width: number
  height: number
}

export default function useSelectionBox({
  stageRef,
  frameRef,
  scene,
  selectedPath,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>
  frameRef: React.RefObject<HTMLDivElement | null>
  scene: SceneJson | null
  selectedPath: string | null
}): SelectionBox | null {
  const [box, setBox] = useState<SelectionBox | null>(null)

  useLayoutEffect(() => {
    if (!scene || !selectedPath || !stageRef.current || !frameRef.current) {
      setBox(null)
      return
    }
    const el = resolveObjectEl(scene, selectedPath, stageRef.current)
    if (!el) {
      setBox(null)
      return
    }
    const frameRect = frameRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setBox({
      left: elRect.left - frameRect.left,
      top: elRect.top - frameRect.top,
      width: elRect.width,
      height: elRect.height,
    })
  }, [scene, selectedPath, stageRef, frameRef])

  return box
}
