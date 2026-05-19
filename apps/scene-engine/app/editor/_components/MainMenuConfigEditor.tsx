'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { FieldRow, InspectorSection } from './inputs/InspectorSection'

const DEFAULT_CONFIG_URL = '/modules/components/main-menu-system/menu-config.json'

const DEFAULT_THEMES: Record<string, MenuTheme> = {
  blue: {
    border: '#3158e8',
    borderSoft: '#617bff',
    sidePanel: '#07515b',
    sideEdge: '#167783',
    sideFrame: '#b8bbc2',
    sideText: '#dce0ee',
    railText: '#aaaeb6',
    wash: 'rgba(39, 76, 222, 0.14)',
  },
  red: {
    border: '#c24334',
    borderSoft: '#e47b65',
    sidePanel: '#563244',
    sideEdge: '#9b4b55',
    sideFrame: '#b7adb2',
    sideText: '#f1d7d6',
    railText: '#c8aeb1',
    wash: 'rgba(188, 54, 42, 0.18)',
  },
  yellow: {
    border: '#b4a64b',
    borderSoft: '#e2cf62',
    sidePanel: '#4d4a35',
    sideEdge: '#9a8740',
    sideFrame: '#c2bda6',
    sideText: '#f4efd3',
    railText: '#c8c0a2',
    wash: 'rgba(188, 160, 42, 0.14)',
  },
  green: {
    border: '#45a86b',
    borderSoft: '#7ee29b',
    sidePanel: '#254f3a',
    sideEdge: '#4c9d65',
    sideFrame: '#b8c9bc',
    sideText: '#e3f7e7',
    railText: '#b4cfba',
    wash: 'rgba(50, 152, 88, 0.16)',
  },
  purple: {
    border: '#7c32c8',
    borderSoft: '#b06aff',
    sidePanel: '#392c5d',
    sideEdge: '#7b48a6',
    sideFrame: '#bcb3ca',
    sideText: '#eadfff',
    railText: '#bdb0d2',
    wash: 'rgba(111, 41, 186, 0.18)',
  },
}

const DEFAULT_MENU_THEMING: MenuTheming = {
  rowHot: '#fbba2d',
  rowPanel: '#050505',
  rowSelectedText: '#050505',
  rowText: '#fbba2d',
  markerPulseColor: '#dce0cd',
  markerContractSpeed: 2,
  markerCooldown: 0,
  markerSingleCooldown: 1.4,
  markerDoubleCooldown: 1.4,
  markerDoubleGap: 0.15,
  markerPulseRadius: 2.7,
  markerPulseTargetRadius: 0,
  markerPulseOpacity: 0.15,
  markerPulseThickness: 1,
  markerPulseFeatherWidth: 4,
  markerPulseEdgeOpacity: 0.21,
  markerRingGlowSize: 0.7,
  markerRingGlowOpacity: 0.07,
  markerInnerPulseColor: '#fff38a',
  markerInnerPulseRadius: 30,
  markerInnerPulseOpacity: 0.8,
  markerInnerPulseGlowSize: 24,
  markerInnerPulseSpeed: 4.2,
}

const LAYOUT_OPTIONS = [
  { value: 'main-stack', label: 'Main Stack' },
  { value: 'left-stack-4', label: 'Left Stack 4' },
  { value: 'left-stack-5', label: 'Left Stack 5' },
  { value: 'options-stack', label: 'Options Stack' },
  { value: 'data-stack', label: 'Data Stack' },
  { value: 'detail-only', label: 'Detail Only' },
]

const PREVIEW_OPTIONS = [
  { value: 'rows', label: 'Rows' },
  { value: 'controller', label: 'Controller' },
  { value: 'display-settings', label: 'Display' },
  { value: 'records-grid', label: 'Records' },
  { value: 'toggles', label: 'Toggle' },
]

const INPUT_CLASS = 'w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none'
const BUTTON_CLASS = 'bg-[#222] text-gray-300 border border-[#333] px-2 py-1 rounded-sm text-[11px] cursor-pointer hover:bg-[#2a2a2a] active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed'

type MenuTheme = Record<string, string | undefined>
type MenuTheming = Record<string, string | number | undefined>

interface MenuPreview {
  type?: string
  rows?: string[]
  label?: string
  value?: string
  railText?: string
}

interface MenuItem {
  id?: string
  label?: string
  description?: string
  caption?: string
  theme?: string
  enter?: string
  preview?: MenuPreview
}

interface MenuNode {
  title?: string
  description?: string
  caption?: string
  theme?: string
  layout?: string
  preview?: MenuPreview
  items?: MenuItem[]
}

interface MenuConfig {
  initial?: string
  menuTheming?: MenuTheming
  themes?: Record<string, MenuTheme>
  menus?: Record<string, MenuNode>
}

interface Props {
  path: string
  properties: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asMenuConfig(value: unknown): MenuConfig | null {
  if (!isRecord(value) || !isRecord(value.menus)) return null
  return value as MenuConfig
}

function cleanString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeId(value: string, fallback: string): string {
  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return id || fallback
}

function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = normalizeId(base, 'menu')
  if (!used.has(root)) return root
  let index = 2
  while (used.has(`${root}-${index}`)) index += 1
  return `${root}-${index}`
}

function normalizeItem(item: unknown, index: number): MenuItem {
  const source = isRecord(item) ? item : {}
  const label = cleanString(source.label, `Item ${index + 1}`)
  const preview = isRecord(source.preview) ? (source.preview as MenuPreview) : { type: 'rows', rows: [] }
  return {
    ...source,
    id: cleanString(source.id, normalizeId(label, `item-${index + 1}`)),
    label,
    description: cleanString(source.description),
    caption: cleanString(source.caption) || undefined,
    theme: cleanString(source.theme) || undefined,
    enter: cleanString(source.enter) || undefined,
    preview,
  }
}

function normalizeMenu(menu: unknown, id: string): MenuNode {
  const source = isRecord(menu) ? menu : {}
  const items = Array.isArray(source.items) ? source.items.map(normalizeItem) : []
  return {
    ...source,
    title: cleanString(source.title, id === 'main' ? 'Main Menu' : id),
    theme: cleanString(source.theme, 'blue'),
    layout: cleanString(source.layout, id === 'main' ? 'main-stack' : 'left-stack-4'),
    description: cleanString(source.description) || undefined,
    caption: cleanString(source.caption) || undefined,
    items,
  }
}

function normalizeConfig(input: MenuConfig | null): MenuConfig {
  const sourceMenus = isRecord(input?.menus) ? input?.menus ?? {} : {}
  const menus = Object.fromEntries(
    Object.entries(sourceMenus).map(([id, menu]) => [normalizeId(id, 'main'), normalizeMenu(menu, id)]),
  ) as Record<string, MenuNode>

  if (Object.keys(menus).length === 0) {
    menus.main = {
      title: 'Main Menu',
      theme: 'blue',
      layout: 'main-stack',
      items: [{ id: 'new-item', label: 'New Item', description: '', preview: { type: 'rows', rows: [] } }],
    }
  }

  const themes = {
    ...DEFAULT_THEMES,
    ...(isRecord(input?.themes) ? input?.themes : {}),
  } as Record<string, MenuTheme>
  const menuTheming = {
    ...DEFAULT_MENU_THEMING,
    ...(isRecord(input?.menuTheming) ? input?.menuTheming : {}),
  } as MenuTheming

  const initial = cleanString(input?.initial)
  return {
    ...input,
    initial: initial && menus[initial] ? initial : Object.keys(menus)[0],
    menuTheming,
    themes,
    menus,
  }
}

function cloneConfig(config: MenuConfig): MenuConfig {
  return structuredClone(config) as MenuConfig
}

function menuIds(config: MenuConfig): string[] {
  return Object.keys(config.menus ?? {})
}

function themeIds(config: MenuConfig): string[] {
  return Object.keys(config.themes ?? DEFAULT_THEMES)
}

function itemName(item: MenuItem, index: number): string {
  return item.label || item.id || `Item ${index + 1}`
}

function previewRows(preview: MenuPreview | undefined): string[] {
  return Array.isArray(preview?.rows) ? preview.rows : []
}

function rowsFromText(value: string): string[] {
  return value
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function hexForInput(value: string | undefined): string {
  const raw = String(value ?? '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
  }
  return '#4e5f6c'
}

function CollapsibleSubsection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1.5 rounded-sm border border-[#333] bg-[#191919]">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 bg-[#242424] px-2 py-1 text-left text-[11px] font-semibold text-gray-300 hover:bg-[#2b2b2b]"
      >
        <span className="w-3 shrink-0 text-gray-500">{open ? 'v' : '>'}</span>
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
      {open && (
        <div className="px-2 py-1.5">
          {children}
        </div>
      )}
    </div>
  )
}

function SmallButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={BUTTON_CLASS}>
      {children}
    </button>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    />
  )
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={INPUT_CLASS}>
      {children}
    </select>
  )
}

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <input
        type="color"
        value={hexForInput(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-6 w-8 shrink-0 bg-transparent border border-[#333] rounded-sm cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  step = 0.01,
  min,
  max,
}: {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(next)
      }}
      className={INPUT_CLASS}
    />
  )
}

export function MainMenuConfigEditor({ path, properties }: Props) {
  const setObjectPropertyAt = useEditorStore((state) => state.setObjectPropertyAt)
  const inlineConfig = asMenuConfig(properties['menu-config'])
  const hasInlineConfig = Boolean(inlineConfig)
  const configUrl = cleanString(properties.config, DEFAULT_CONFIG_URL)
  const [loadedConfig, setLoadedConfig] = useState<MenuConfig | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedMenu, setSelectedMenu] = useState('main')
  const [selectedItemIndex, setSelectedItemIndex] = useState(0)
  const [selectedTheme, setSelectedTheme] = useState('blue')
  const [draftMenuId, setDraftMenuId] = useState('main')

  useEffect(() => {
    if (hasInlineConfig) return
    let cancelled = false
    setLoadError(null)
    fetch(configUrl, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Config ${response.status}`)
        return response.json()
      })
      .then((json) => {
        if (!cancelled) setLoadedConfig(asMenuConfig(json))
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load config')
      })
    return () => {
      cancelled = true
    }
  }, [configUrl, hasInlineConfig])

  const config = useMemo(
    () => normalizeConfig(inlineConfig ?? loadedConfig),
    [inlineConfig, loadedConfig],
  )
  const menus = config.menus ?? {}
  const ids = menuIds(config)
  const menuTheming = config.menuTheming ?? DEFAULT_MENU_THEMING
  const themes = config.themes ?? DEFAULT_THEMES
  const themeOptions = themeIds(config)
  const activeMenuId = menus[selectedMenu] ? selectedMenu : ids[0]
  const menu = menus[activeMenuId] ?? normalizeMenu(null, activeMenuId)
  const items = Array.isArray(menu.items) ? menu.items : []
  const itemIndex = Math.max(0, Math.min(selectedItemIndex, Math.max(0, items.length - 1)))
  const selectedItem = items[itemIndex]
  const activeThemeId = themes[selectedTheme] ? selectedTheme : themeOptions[0]
  const activeTheme = themes[activeThemeId] ?? DEFAULT_THEMES.blue

  useEffect(() => {
    if (!menus[selectedMenu] && ids[0]) setSelectedMenu(ids[0])
  }, [ids, menus, selectedMenu])

  useEffect(() => {
    setDraftMenuId(activeMenuId)
  }, [activeMenuId])

  useEffect(() => {
    if (selectedItemIndex !== itemIndex) setSelectedItemIndex(itemIndex)
  }, [itemIndex, selectedItemIndex])

  function writeConfig(next: MenuConfig) {
    setObjectPropertyAt(path, 'properties.menu-config', normalizeConfig(next))
  }

  function updateConfig(mutator: (next: MenuConfig) => void) {
    const next = cloneConfig(config)
    mutator(next)
    writeConfig(next)
  }

  function previewMenu(menuId: string) {
    setSelectedMenu(menuId)
    setSelectedItemIndex(0)
    setObjectPropertyAt(path, 'properties.initial-menu', menuId)
  }

  function updateMenuField(key: keyof MenuNode, value: string | undefined) {
    updateConfig((next) => {
      const target = next.menus?.[activeMenuId]
      if (!target) return
      ;(target as Record<string, unknown>)[key] = value
    })
  }

  function updateMenuThemingField(key: string, value: string | number) {
    updateConfig((next) => {
      next.menuTheming = {
        ...DEFAULT_MENU_THEMING,
        ...(isRecord(next.menuTheming) ? next.menuTheming : {}),
        [key]: value,
      }
    })
  }

  function updateItem(mutator: (item: MenuItem) => void) {
    updateConfig((next) => {
      const target = next.menus?.[activeMenuId]
      if (!target) return
      const nextItems = Array.isArray(target.items) ? target.items : []
      const item = nextItems[itemIndex]
      if (!item) return
      mutator(item)
      target.items = nextItems
    })
  }

  function addMenu() {
    const nextId = uniqueId('new-menu', ids)
    updateConfig((next) => {
      if (!next.menus) next.menus = {}
      next.menus[nextId] = {
        title: 'New Menu',
        theme: menu.theme ?? 'blue',
        layout: 'left-stack-4',
        items: [{ id: 'new-item', label: 'New Item', description: '', preview: { type: 'rows', rows: [] } }],
      }
    })
    previewMenu(nextId)
  }

  function deleteMenu() {
    if (ids.length <= 1) return
    const fallback = ids.find((id) => id !== activeMenuId) ?? ids[0]
    updateConfig((next) => {
      if (!next.menus) return
      delete next.menus[activeMenuId]
      if (next.initial === activeMenuId) next.initial = fallback
      Object.values(next.menus).forEach((entry) => {
        entry.items?.forEach((item) => {
          if (item.enter === activeMenuId) item.enter = undefined
        })
      })
    })
    previewMenu(fallback)
  }

  function commitMenuId() {
    const nextId = normalizeId(draftMenuId, activeMenuId)
    if (nextId === activeMenuId) {
      setDraftMenuId(activeMenuId)
      return
    }
    if (menus[nextId]) {
      setDraftMenuId(activeMenuId)
      return
    }
    updateConfig((next) => {
      if (!next.menus?.[activeMenuId]) return
      next.menus[nextId] = next.menus[activeMenuId]
      delete next.menus[activeMenuId]
      if (next.initial === activeMenuId) next.initial = nextId
      Object.values(next.menus).forEach((entry) => {
        entry.items?.forEach((item) => {
          if (item.enter === activeMenuId) item.enter = nextId
        })
      })
    })
    previewMenu(nextId)
  }

  function addItem() {
    updateConfig((next) => {
      const target = next.menus?.[activeMenuId]
      if (!target) return
      const nextItems = Array.isArray(target.items) ? target.items : []
      nextItems.push({
        id: uniqueId('new-item', nextItems.map((item) => item.id ?? '')),
        label: 'New Item',
        description: '',
        preview: { type: 'rows', rows: [] },
      })
      target.items = nextItems
    })
    setSelectedItemIndex(items.length)
  }

  function deleteItem() {
    if (!selectedItem) return
    updateConfig((next) => {
      const target = next.menus?.[activeMenuId]
      if (!target || !Array.isArray(target.items)) return
      target.items.splice(itemIndex, 1)
    })
    setSelectedItemIndex(Math.max(0, itemIndex - 1))
  }

  function moveItem(delta: number) {
    if (!selectedItem) return
    const nextIndex = itemIndex + delta
    if (nextIndex < 0 || nextIndex >= items.length) return
    updateConfig((next) => {
      const target = next.menus?.[activeMenuId]
      if (!target || !Array.isArray(target.items)) return
      const [item] = target.items.splice(itemIndex, 1)
      target.items.splice(nextIndex, 0, item)
    })
    setSelectedItemIndex(nextIndex)
  }

  function createChildMenu() {
    if (!selectedItem) return
    const nextId = uniqueId(selectedItem.label || 'child-menu', ids)
    updateConfig((next) => {
      if (!next.menus) next.menus = {}
      next.menus[nextId] = {
        title: selectedItem.label || 'New Menu',
        theme: selectedItem.theme || menu.theme || 'blue',
        layout: 'left-stack-4',
        items: [{ id: 'new-item', label: 'New Item', description: '', preview: { type: 'rows', rows: [] } }],
      }
      const target = next.menus[activeMenuId]
      const item = target?.items?.[itemIndex]
      if (item) item.enter = nextId
    })
    previewMenu(nextId)
  }

  function setPreviewType(type: string) {
    updateItem((item) => {
      if (type === 'rows') {
        item.preview = { type, rows: previewRows(item.preview) }
      } else if (type === 'toggles') {
        item.preview = { type, label: item.preview?.label ?? item.label ?? 'Option', value: item.preview?.value ?? 'ON' }
      } else {
        item.preview = { type }
      }
    })
  }

  function updateThemeField(key: string, value: string) {
    updateConfig((next) => {
      if (!next.themes) next.themes = {}
      next.themes[activeThemeId] = {
        ...(DEFAULT_THEMES[activeThemeId] ?? {}),
        ...(next.themes[activeThemeId] ?? {}),
        [key]: value,
      }
    })
  }

  function addTheme() {
    const nextId = uniqueId('theme', themeOptions)
    updateConfig((next) => {
      if (!next.themes) next.themes = {}
      next.themes[nextId] = { ...DEFAULT_THEMES.blue }
    })
    setSelectedTheme(nextId)
  }

  const menuThemingString = (key: string) => String(menuTheming[key] ?? DEFAULT_MENU_THEMING[key] ?? '')
  const menuThemingNumber = (key: string) => {
    const value = Number(menuTheming[key] ?? DEFAULT_MENU_THEMING[key] ?? 0)
    return Number.isFinite(value) ? value : 0
  }

  if (!hasInlineConfig && !loadedConfig && !loadError) {
    return (
      <InspectorSection title="Menu Data">
        <p className="px-1 py-1 text-[11px] text-gray-500">Loading menu data...</p>
      </InspectorSection>
    )
  }

  return (
    <>
      <InspectorSection title="Menu Theming">
        <CollapsibleSubsection title="Row Colors">
          <FieldRow label="Hot Gold">
            <ColorInput value={menuThemingString('rowHot')} onChange={(value) => updateMenuThemingField('rowHot', value)} />
          </FieldRow>
          <FieldRow label="Row Base">
            <ColorInput value={menuThemingString('rowPanel')} onChange={(value) => updateMenuThemingField('rowPanel', value)} />
          </FieldRow>
          <FieldRow label="Row Text">
            <ColorInput value={menuThemingString('rowText')} onChange={(value) => updateMenuThemingField('rowText', value)} />
          </FieldRow>
          <FieldRow label="Selected">
            <ColorInput value={menuThemingString('rowSelectedText')} onChange={(value) => updateMenuThemingField('rowSelectedText', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Marker Pulse">
          <FieldRow label="Pulse">
            <ColorInput value={menuThemingString('markerPulseColor')} onChange={(value) => updateMenuThemingField('markerPulseColor', value)} />
          </FieldRow>
          <FieldRow label="Pulse Speed">
            <NumberInput value={menuThemingNumber('markerContractSpeed')} min={0} max={12} step={0.1} onChange={(value) => updateMenuThemingField('markerContractSpeed', value)} />
          </FieldRow>
          <FieldRow label="Radius">
            <NumberInput value={menuThemingNumber('markerPulseRadius')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseRadius', value)} />
          </FieldRow>
          <FieldRow label="Target">
            <NumberInput value={menuThemingNumber('markerPulseTargetRadius')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseTargetRadius', value)} />
          </FieldRow>
          <FieldRow label="Opacity">
            <NumberInput value={menuThemingNumber('markerPulseOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerPulseOpacity', value)} />
          </FieldRow>
          <FieldRow label="Thickness">
            <NumberInput value={menuThemingNumber('markerPulseThickness')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseThickness', value)} />
          </FieldRow>
          <FieldRow label="Feather">
            <NumberInput value={menuThemingNumber('markerPulseFeatherWidth')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseFeatherWidth', value)} />
          </FieldRow>
          <FieldRow label="Edge Opacity">
            <NumberInput value={menuThemingNumber('markerPulseEdgeOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerPulseEdgeOpacity', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Pulse Timing">
          <FieldRow label="Single Cool">
            <NumberInput value={menuThemingNumber('markerSingleCooldown')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerSingleCooldown', value)} />
          </FieldRow>
          <FieldRow label="Double Cool">
            <NumberInput value={menuThemingNumber('markerDoubleCooldown')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerDoubleCooldown', value)} />
          </FieldRow>
          <FieldRow label="Double Gap">
            <NumberInput value={menuThemingNumber('markerDoubleGap')} min={0} max={3} step={0.01} onChange={(value) => updateMenuThemingField('markerDoubleGap', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Ring Glow">
          <FieldRow label="Ring Glow">
            <NumberInput value={menuThemingNumber('markerRingGlowSize')} min={0} max={8} step={0.1} onChange={(value) => updateMenuThemingField('markerRingGlowSize', value)} />
          </FieldRow>
          <FieldRow label="Ring Alpha">
            <NumberInput value={menuThemingNumber('markerRingGlowOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerRingGlowOpacity', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Inner Pulse">
          <FieldRow label="Inner Color">
            <ColorInput value={menuThemingString('markerInnerPulseColor')} onChange={(value) => updateMenuThemingField('markerInnerPulseColor', value)} />
          </FieldRow>
          <FieldRow label="Inner Size">
            <NumberInput value={menuThemingNumber('markerInnerPulseRadius')} min={0} max={120} step={1} onChange={(value) => updateMenuThemingField('markerInnerPulseRadius', value)} />
          </FieldRow>
          <FieldRow label="Inner Alpha">
            <NumberInput value={menuThemingNumber('markerInnerPulseOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerInnerPulseOpacity', value)} />
          </FieldRow>
          <FieldRow label="Inner Glow">
            <NumberInput value={menuThemingNumber('markerInnerPulseGlowSize')} min={0} max={80} step={1} onChange={(value) => updateMenuThemingField('markerInnerPulseGlowSize', value)} />
          </FieldRow>
          <FieldRow label="Inner Speed">
            <NumberInput value={menuThemingNumber('markerInnerPulseSpeed')} min={0} max={12} step={0.1} onChange={(value) => updateMenuThemingField('markerInnerPulseSpeed', value)} />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Menu Data">
        {loadError && (
          <p className="mb-1.5 rounded-sm border border-[#6e3a3a] bg-[#2a1717] px-2 py-1 text-[11px] text-[#ffb8b8]">
            {loadError}
          </p>
        )}
        <FieldRow label="Initial">
          <SelectInput
            value={config.initial ?? activeMenuId}
            onChange={(value) => {
              updateConfig((next) => {
                next.initial = value
              })
              previewMenu(value)
            }}
          >
            {ids.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Editing">
          <SelectInput value={activeMenuId} onChange={previewMenu}>
            {ids.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </SelectInput>
        </FieldRow>
        <div className="mb-1.5 flex gap-1.5">
          <SmallButton onClick={addMenu}>Add Menu</SmallButton>
          <SmallButton onClick={deleteMenu} disabled={ids.length <= 1}>Delete</SmallButton>
        </div>
        <FieldRow label="Menu ID">
          <input
            type="text"
            value={draftMenuId}
            onChange={(event) => setDraftMenuId(event.target.value)}
            onBlur={commitMenuId}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                setDraftMenuId(activeMenuId)
                event.currentTarget.blur()
              }
            }}
            className={INPUT_CLASS}
          />
        </FieldRow>
        <FieldRow label="Title">
          <TextInput value={menu.title ?? ''} onChange={(value) => updateMenuField('title', value)} />
        </FieldRow>
        <FieldRow label="Theme">
          <SelectInput value={menu.theme ?? 'blue'} onChange={(value) => updateMenuField('theme', value)}>
            {themeOptions.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </SelectInput>
        </FieldRow>
        <FieldRow label="Layout">
          <SelectInput value={menu.layout ?? 'left-stack-4'} onChange={(value) => updateMenuField('layout', value)}>
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </SelectInput>
        </FieldRow>
      </InspectorSection>

      <InspectorSection title="Menu Items">
        <FieldRow label="Item">
          <SelectInput value={String(itemIndex)} onChange={(value) => setSelectedItemIndex(Number(value))}>
            {items.length === 0 ? (
              <option value="0">No items</option>
            ) : items.map((entry, index) => (
              <option key={`${entry.id ?? 'item'}-${index}`} value={String(index)}>
                {index + 1}. {itemName(entry, index)}
              </option>
            ))}
          </SelectInput>
        </FieldRow>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <SmallButton onClick={addItem}>Add</SmallButton>
          <SmallButton onClick={() => moveItem(-1)} disabled={!selectedItem || itemIndex === 0}>Up</SmallButton>
          <SmallButton onClick={() => moveItem(1)} disabled={!selectedItem || itemIndex >= items.length - 1}>Down</SmallButton>
          <SmallButton onClick={deleteItem} disabled={!selectedItem}>Delete</SmallButton>
        </div>
        {selectedItem && (
          <>
            <FieldRow label="Item ID">
              <TextInput
                value={selectedItem.id ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.id = normalizeId(value, item.id ?? `item-${itemIndex + 1}`)
                })}
              />
            </FieldRow>
            <FieldRow label="Label">
              <TextInput
                value={selectedItem.label ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.label = value
                })}
              />
            </FieldRow>
            <FieldRow label="Desc">
              <TextInput
                value={selectedItem.description ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.description = value
                })}
              />
            </FieldRow>
            <FieldRow label="Caption">
              <TextInput
                value={selectedItem.caption ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.caption = optional(value)
                })}
              />
            </FieldRow>
            <FieldRow label="Theme">
              <SelectInput
                value={selectedItem.theme ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.theme = optional(value)
                })}
              >
                <option value="">Menu theme</option>
                {themeOptions.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Enter">
              <SelectInput
                value={selectedItem.enter ?? ''}
                onChange={(value) => updateItem((item) => {
                  item.enter = optional(value)
                })}
              >
                <option value="">None</option>
                {ids.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </SelectInput>
            </FieldRow>
            <div className="mb-1.5 flex gap-1.5">
              <SmallButton onClick={createChildMenu}>Create Child</SmallButton>
              {selectedItem.enter && <SmallButton onClick={() => previewMenu(selectedItem.enter!)}>Open Child</SmallButton>}
            </div>
            <FieldRow label="Preview">
              <SelectInput value={selectedItem.preview?.type ?? 'rows'} onChange={setPreviewType}>
                {PREVIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectInput>
            </FieldRow>
            {(selectedItem.preview?.type ?? 'rows') === 'rows' && (
              <FieldRow label="Rows">
                <textarea
                  value={previewRows(selectedItem.preview).join('\n')}
                  onChange={(event) => updateItem((item) => {
                    item.preview = { ...(item.preview ?? {}), type: 'rows', rows: rowsFromText(event.target.value) }
                  })}
                  rows={4}
                  className={`${INPUT_CLASS} resize-y leading-snug`}
                />
              </FieldRow>
            )}
            {selectedItem.preview?.type === 'toggles' && (
              <>
                <FieldRow label="Toggle">
                  <TextInput
                    value={selectedItem.preview.label ?? ''}
                    onChange={(value) => updateItem((item) => {
                      item.preview = { ...(item.preview ?? {}), type: 'toggles', label: value }
                    })}
                  />
                </FieldRow>
                <FieldRow label="Value">
                  <TextInput
                    value={selectedItem.preview.value ?? ''}
                    onChange={(value) => updateItem((item) => {
                      item.preview = { ...(item.preview ?? {}), type: 'toggles', value }
                    })}
                  />
                </FieldRow>
              </>
            )}
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Menu Themes">
        <FieldRow label="Theme">
          <SelectInput value={activeThemeId} onChange={setSelectedTheme}>
            {themeOptions.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </SelectInput>
        </FieldRow>
        <div className="mb-1.5 flex gap-1.5">
          <SmallButton onClick={addTheme}>Add Theme</SmallButton>
        </div>
        <CollapsibleSubsection title="Shield Frame">
          <FieldRow label="Border">
            <ColorInput value={activeTheme.border ?? ''} onChange={(value) => updateThemeField('border', value)} />
          </FieldRow>
          <FieldRow label="Glow">
            <ColorInput value={activeTheme.borderSoft ?? ''} onChange={(value) => updateThemeField('borderSoft', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Side Panel">
          <FieldRow label="Side Fill">
            <ColorInput value={activeTheme.sidePanel ?? ''} onChange={(value) => updateThemeField('sidePanel', value)} />
          </FieldRow>
          <FieldRow label="Side Edge">
            <ColorInput value={activeTheme.sideEdge ?? ''} onChange={(value) => updateThemeField('sideEdge', value)} />
          </FieldRow>
          <FieldRow label="Side Frame">
            <ColorInput value={activeTheme.sideFrame ?? ''} onChange={(value) => updateThemeField('sideFrame', value)} />
          </FieldRow>
          <FieldRow label="Side Text">
            <ColorInput value={activeTheme.sideText ?? ''} onChange={(value) => updateThemeField('sideText', value)} />
          </FieldRow>
          <FieldRow label="Rail Text">
            <ColorInput value={activeTheme.railText ?? ''} onChange={(value) => updateThemeField('railText', value)} />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Wash">
          <FieldRow label="Wash">
            <TextInput value={activeTheme.wash ?? ''} onChange={(value) => updateThemeField('wash', value)} />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>
    </>
  )
}

export default MainMenuConfigEditor
