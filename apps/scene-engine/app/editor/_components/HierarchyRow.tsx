'use client'

interface Props {
  layer: Record<string, unknown>
  path: string
  depth: number
  isSelected: boolean
  isCollapsed: boolean
  onSelect: (path: string) => void
  onToggle: (path: string) => void
  onToggleVisibility: (path: string, visible: boolean) => void
  collapsedSet: Set<string>
  selectedPath: string | null
  onDragStart?: (e: React.DragEvent, path: string) => void
  onDragOver?: (e: React.DragEvent, path: string) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent, path: string) => void
  dropIndicator: { path: string; region: string } | null
}

export function HierarchyRow({
  layer,
  path,
  depth,
  isSelected,
  isCollapsed,
  onSelect,
  onToggle,
  onToggleVisibility,
  collapsedSet,
  selectedPath,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dropIndicator,
}: Props) {
  const hasChildren = Array.isArray(layer.children) && (layer.children as unknown[]).length > 0
  const isHidden = layer.visible === false
  const typeLabel = (layer.type as string) ?? (layer.layer ? 'sub-layer' : '')

  const isDropBefore = dropIndicator?.path === path && dropIndicator.region === 'before'
  const isDropAfter = dropIndicator?.path === path && dropIndicator.region === 'after'
  const isDropInto = dropIndicator?.path === path && dropIndicator.region === 'into'

  return (
    <li>
      <div
        className={`relative flex items-center gap-1 py-0.5 px-1 cursor-default select-none text-xs font-mono
          ${isSelected ? 'bg-[#1d3247] outline outline-1 outline-[#2a6da3]' : 'hover:bg-[#222]'}
          ${isHidden ? 'opacity-40' : ''}
          ${isDropInto ? 'bg-[rgba(255,216,77,0.18)] outline outline-1 outline-[#ffd84d]' : ''}
        `}
        style={{ paddingLeft: depth * 14 + 4 }}
        onClick={() => onSelect(path)}
        draggable
        onDragStart={(e) => onDragStart?.(e, path)}
        onDragOver={(e) => onDragOver?.(e, path)}
        onDragLeave={(e) => onDragLeave?.(e)}
        onDrop={(e) => onDrop?.(e, path)}
        data-path={path}
      >
        {isDropBefore && (
          <div className="absolute left-0 right-0 top-[-1px] h-0.5 bg-[#ffd84d] pointer-events-none" />
        )}
        {isDropAfter && (
          <div className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-[#ffd84d] pointer-events-none" />
        )}

        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(path) }}
            className="bg-transparent border-0 text-gray-400 text-xs w-3.5 text-center shrink-0 cursor-pointer p-0"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(path, isHidden) }}
          className="bg-transparent border-0 text-gray-400 text-[10px] w-3.5 text-center shrink-0 cursor-pointer p-0 leading-none hover:text-gray-300"
        >
          {isHidden ? '○' : '●'}
        </button>

        <span className="text-gray-300 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {(layer.name as string | undefined) ?? (layer.id as string)}{' '}
          <span className="text-gray-600">[{typeLabel}]</span>
        </span>
      </div>

      {hasChildren && !isCollapsed && (
        <ul className="list-none p-0 m-0">
          {(layer.children as Record<string, unknown>[]).map((child, i) => {
            const childPath = `${path}.children.${i}`
            return (
              <HierarchyRow
                key={childPath}
                layer={child}
                path={childPath}
                depth={depth + 1}
                isSelected={selectedPath === childPath}
                isCollapsed={collapsedSet.has(childPath)}
                onSelect={onSelect}
                onToggle={onToggle}
                onToggleVisibility={onToggleVisibility}
                collapsedSet={collapsedSet}
                selectedPath={selectedPath}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                dropIndicator={dropIndicator}
              />
            )
          })}
        </ul>
      )}
    </li>
  )
}
