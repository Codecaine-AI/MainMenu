'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  label: string
  description?: string
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
}

interface Position {
  top: number
  left: number
}

export function DescriptionPopover({ label, description, anchorEl, open, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setPosition(null)
      return
    }
    const rect = anchorEl.getBoundingClientRect()
    setPosition({ top: rect.bottom + 4, left: rect.left })
  }, [open, anchorEl])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node | null
      if (popoverRef.current && target && popoverRef.current.contains(target)) return
      if (anchorEl && target && anchorEl.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleMouseDown)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, onClose, anchorEl])

  if (!open || !anchorEl || !mounted || !position) return null

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-50 max-w-[260px] rounded-sm border border-[#3a3a3a] bg-[#111] px-2 py-1.5 text-gray-200 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="tooltip"
    >
      <div className="text-[12px] font-semibold text-gray-100">{label}</div>
      {description && (
        <div className="mt-0.5 whitespace-pre-line text-[11px] leading-tight text-gray-300">
          {description}
        </div>
      )}
    </div>,
    document.body,
  )
}

export default DescriptionPopover
