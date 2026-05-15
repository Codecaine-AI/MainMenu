'use client'

import type { CSSProperties } from 'react'
import type { HandleId } from '@/lib/resize-math'
import type { SelectionBox } from './useSelectionBox'

const HANDLE_BASE: CSSProperties = {
  position: 'absolute',
  width: 8,
  height: 8,
  background: '#ffd84d',
  border: '1px solid #fff',
  boxSizing: 'border-box',
  pointerEvents: 'auto',
}

const HANDLES: Array<{ id: HandleId; style: CSSProperties; cursor: string }> = [
  { id: 'nw', style: { left: -4, top: -4 }, cursor: 'nwse-resize' },
  { id: 'n', style: { left: '50%', top: -4, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'ne', style: { right: -4, top: -4 }, cursor: 'nesw-resize' },
  { id: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  { id: 'se', style: { right: -4, bottom: -4 }, cursor: 'nwse-resize' },
  { id: 's', style: { left: '50%', bottom: -4, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
  { id: 'sw', style: { left: -4, bottom: -4 }, cursor: 'nesw-resize' },
  { id: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
]

export default function SelectionOverlay({
  box,
  onHandleMouseDown,
}: {
  box: SelectionBox | null
  onHandleMouseDown: (handle: HandleId, e: React.MouseEvent<HTMLDivElement>) => void
}) {
  if (!box) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        pointerEvents: 'none',
        outline: '2px solid #ffd84d',
        outlineOffset: '2px',
        boxShadow: '0 0 0 4px rgba(255, 216, 77, 0.18)',
      }}
    >
      {HANDLES.map((h) => (
        <div
          key={h.id}
          data-handle={h.id}
          style={{ ...HANDLE_BASE, ...h.style, cursor: h.cursor }}
          onMouseDown={(e) => onHandleMouseDown(h.id, e)}
        />
      ))}
    </div>
  )
}
