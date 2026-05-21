'use client'

import { useEffect, useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { FieldRow, InspectorSection } from './inputs/InspectorSection'
import { RangedInput } from './inputs/RangedInput'
import type { Registry } from '@/types/scene'

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
    sidePanel: '#5a2d1f',
    sideEdge: '#b85a2c',
    sideFrame: '#d1a184',
    sideText: '#ffe0d1',
    railText: '#dca78d',
    wash: 'rgba(188, 54, 42, 0.18)',
  },
  yellow: {
    border: '#b4a64b',
    borderSoft: '#e2cf62',
    sidePanel: '#4a431c',
    sideEdge: '#c18c2f',
    sideFrame: '#d5b967',
    sideText: '#fff1bc',
    railText: '#d7bd6a',
    wash: 'rgba(188, 160, 42, 0.14)',
  },
  green: {
    border: '#45a86b',
    borderSoft: '#7ee29b',
    sidePanel: '#194f46',
    sideEdge: '#2db38d',
    sideFrame: '#93cfba',
    sideText: '#d9fff2',
    railText: '#98d7c2',
    wash: 'rgba(50, 152, 88, 0.16)',
  },
  purple: {
    border: '#7c32c8',
    borderSoft: '#b06aff',
    sidePanel: '#2f3267',
    sideEdge: '#5b62c9',
    sideFrame: '#a8aee4',
    sideText: '#e3e7ff',
    railText: '#aeb5e5',
    wash: 'rgba(111, 41, 186, 0.18)',
  },
}

const DEFAULT_MENU_THEMING: MenuTheming = {
  rowHot: '#fbba2d',
  rowPanel: '#050505',
  rowSelectedText: '#050505',
  rowText: '#fbba2d',
  titleTextColor: '#ededed',
  titleTextOpacity: 1,
  titleTextGlowSize: 0,
  titleTextGlowOpacity: 0,
  captionTextColor: '#e4e7ff',
  sideTextColor: '#dce0ee',
  railTextColor: '#aaaeb6',
  rowEdgeOpacity: 0.84,
  rowEdgeFeather: 0.7,
  rowEdgeGlowSize: 7,
  rowEdgeGlowOpacity: 0.45,
  rowSelectedEdgeOpacity: 0.96,
  rowSelectedEdgeFeather: 0.5,
  rowSelectedEdgeGlowSize: 12,
  rowSelectedEdgeGlowOpacity: 0.62,
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

const STACK_LAYOUT_IDS = ['left-stack-5', 'left-stack-4', 'left-stack-3'] as const

const DEFAULT_LAYOUTS: Record<string, MenuLayout> = {
  'left-stack-5': {
    label: 'Five Stack',
    itemCount: 5,
    yStart: 274,
    spacing: 119,
    rowX: [326, 210, 98, 154, 116],
    rowWidth: 760,
    itemProps: {
      'x-offset': -50,
      'y-offset': -10,
      'width-scale': 0.84,
      'font-scale': 0.96,
      'text-max-font-size': 64,
    },
  },
  'left-stack-4': {
    label: 'Four Stack',
    itemCount: 4,
    yStart: 276,
    spacing: 128,
    rowX: [320, 215, 100, 170],
    rowWidth: 760,
    itemProps: {
      'x-offset': -54,
      'y-offset': 10,
      'width-scale': 0.86,
      'text-max-font-size': 64,
    },
  },
  'left-stack-3': {
    label: 'Three Stack',
    itemCount: 3,
    yStart: 306,
    spacing: 184,
    rowX: [328, 120, 112],
    rowWidth: 760,
    itemProps: {
      'x-offset': -70,
      'y-offset': 38,
      'width-scale': 0.88,
      'font-scale': 0.94,
      'text-max-font-size': 60,
    },
  },
}

const LAYOUT_OPTIONS = [
  { value: 'left-stack-5', label: 'Five Stack' },
  { value: 'left-stack-4', label: 'Four Stack' },
  { value: 'left-stack-3', label: 'Three Stack' },
]

const PREVIEW_OPTIONS = [
  { value: 'rows', label: 'Rows' },
  { value: 'empty', label: 'Empty' },
  { value: 'image', label: 'Image' },
  { value: 'controller', label: 'Controller' },
  { value: 'display-settings', label: 'Display' },
  { value: 'records-grid', label: 'Records' },
  { value: 'toggles', label: 'Toggle' },
]

const DEFAULT_AUDIO = {
  navigationSound: 'ui-navigation',
  forwardSound: 'ui-forward',
  backSound: 'ui-back',
  navigationVolume: 1,
  forwardVolume: 1,
  backVolume: 1,
  backTarget: 'title',
}

const DEFAULT_MOTION = {
  transitionMs: 300,
  themeTransitionMs: 220,
  targetFadeMs: 140,
  menuItemColorMs: 140,
  captionFadeMs: 220,
  orbitRadius: 360,
  orbitAngle: 18,
  orbitDebug: false,
  orbitCenterX: 720,
  orbitCenterY: 540,
  orbitDebugOpacity: 0.86,
  titlePrismMs: 340,
  titlePrismDepth: 66,
  titlePrismLift: 24,
  titlePrismPerspective: 620,
  titlePrismAngle: 120,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
}

const DEFAULT_AUTHORING = {
  initialSelectedIndex: 1,
}

const DEFAULT_STACK_TUNING = {
  menuXOffset: 0,
  menuYOffset: 0,
  menuScale: 1,
  menuWidthScale: 1,
  menuFontScale: 1,
}

const DEFAULT_SHIELD_TEXT = {
  titleX: 179,
  titleY: 120,
  titleBoxWidth: 445,
  titleBoxHeight: 76,
  titleFitPaddingX: 16,
  titleFitPaddingY: 8,
  titleFontSize: 47,
  captionCenterInBox: true,
  captionX: 730,
  captionY: 950,
  captionFontSize: 56,
  captionBoxX: 344,
  captionBoxY: 902,
  captionBoxWidth: 762,
  captionBoxHeight: 85,
  shieldTextDebug: false,
}

const DEFAULT_SIDE_PREVIEW = {
  sideX: 67,
  sideY: 0,
  sideScale: 1,
  sidePerspective: 1700,
  sidePanelOpacity: 0.53,
  sideFrameVisible: true,
  sideRainDensity: 36,
  sideRainSpeed: 0.9,
  sideRainColorOffset: 0.36,
  sideRainXScale: 1,
  sideRainYScale: 1,
  sideContentX: 1027,
  sideContentY: 452,
  sideContentWidth: 250,
  sideLineHeight: 70,
  sideFontScale: 1,
  sideTextOpacity: 1,
  sideRailVisible: true,
  sideRailX: 919,
  sideRailY: 565,
  sideRailRotation: -90,
  sideRailFontSize: 36,
}

const DEFAULT_DETAIL_PREVIEW = {
  detailX: 910,
  detailY: 318,
  detailWidth: 388,
  detailWideX: 730,
  detailWideY: 238,
  detailWideWidth: 574,
  backButtonX: 150,
  backButtonY: 112,
}

const MOTION_EASING_OPTIONS = [
  { value: 'cubic-bezier(0.16, 1, 0.3, 1)', label: 'Fluid' },
  { value: 'cubic-bezier(0.2, 0.8, 0.2, 1)', label: 'Soft' },
  { value: 'cubic-bezier(0.22, 1, 0.36, 1)', label: 'Snap' },
  { value: 'ease-in-out', label: 'Even' },
  { value: 'linear', label: 'Linear' },
]

const INPUT_CLASS = 'w-full bg-[#222] border border-[#333] text-gray-300 text-[11px] font-mono px-1 py-[3px] rounded-sm focus:border-[#4a8fc2] focus:outline-none'
const BUTTON_CLASS = 'bg-[#222] text-gray-300 border border-[#333] px-2 py-1 rounded-sm text-[11px] cursor-pointer hover:bg-[#2a2a2a] active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed'

type MenuTheme = Record<string, string | undefined>
type MenuTheming = Record<string, string | number | undefined>
type LayoutItemProps = Record<string, string | number | boolean | undefined>

interface MenuLayout {
  label?: string
  itemCount?: number
  yStart?: number
  spacing?: number
  rowX?: number[]
  rowWidth?: number
  itemProps?: LayoutItemProps
}

interface MenuPreview {
  type?: string
  rows?: string[]
  label?: string
  value?: string
  railText?: string
  railTextColor?: string
  railColor?: string
  railTextOpacity?: number
  railOpacity?: number
  src?: string
  image?: string
  asset?: string
  sidePanel?: MenuPreview
  detail?: MenuPreview | null
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
  layouts?: Record<string, MenuLayout>
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

function cleanNumber(value: unknown, fallback: number): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function cleanNumberArray(value: unknown, fallback: number[] = []): number[] {
  return Array.isArray(value)
    ? value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    : [...fallback]
}

function cleanRowWidth(value: unknown, fallback = 760): number {
  if (Array.isArray(value)) {
    const widths = value.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry) && entry > 0)
    if (widths.length) return Math.max(...widths)
  }
  return cleanNumber(value, fallback)
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
    layout: cleanString(source.layout, 'left-stack-5'),
    description: cleanString(source.description) || undefined,
    caption: cleanString(source.caption) || undefined,
    items,
  }
}

function normalizeLayout(layout: unknown, id: string): MenuLayout {
  const source = isRecord(layout) ? layout : {}
  const defaults = DEFAULT_LAYOUTS[id] ?? {}
  const itemProps = {
    ...(isRecord(defaults.itemProps) ? defaults.itemProps : {}),
    ...(isRecord(source.itemProps) ? source.itemProps : {}),
  } as LayoutItemProps
  const itemCountFallback = cleanNumber(defaults.itemCount, 5)
  const itemCount = Math.max(1, Math.min(5, Math.round(cleanNumber(source.itemCount, itemCountFallback))))
  const normalized: MenuLayout = {
    ...defaults,
    ...source,
    label: cleanString(source.label, defaults.label ?? id),
    itemProps,
  }
  if (source.itemCount !== undefined || defaults.itemCount !== undefined) normalized.itemCount = itemCount
  if (source.yStart !== undefined || defaults.yStart !== undefined) {
    normalized.yStart = cleanNumber(source.yStart, cleanNumber(defaults.yStart, 274))
  }
  if (source.spacing !== undefined || defaults.spacing !== undefined) {
    normalized.spacing = cleanNumber(source.spacing, cleanNumber(defaults.spacing, 119))
  }
  if (source.rowX !== undefined || defaults.rowX !== undefined) {
    normalized.rowX = cleanNumberArray(source.rowX, defaults.rowX).slice(0, itemCount)
  }
  if (source.rowWidth !== undefined || defaults.rowWidth !== undefined) {
    normalized.rowWidth = cleanRowWidth(source.rowWidth, cleanRowWidth(defaults.rowWidth, 760))
  }
  return normalized
}

function normalizeLayouts(input: unknown): Record<string, MenuLayout> {
  const source = isRecord(input) ? input : {}
  const ids = new Set(STACK_LAYOUT_IDS)
  return Object.fromEntries(
    [...ids].map((id) => [id, normalizeLayout(source[id], id)]),
  ) as Record<string, MenuLayout>
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
      layout: 'left-stack-5',
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
  const layouts = normalizeLayouts(input?.layouts)

  const initial = cleanString(input?.initial)
  return {
    ...input,
    initial: initial && menus[initial] ? initial : Object.keys(menus)[0],
    layouts,
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

function layoutIds(config: MenuConfig): string[] {
  const ordered = LAYOUT_OPTIONS.map((option) => option.value)
  return ordered
}

function layoutLabel(config: MenuConfig, id: string): string {
  return config.layouts?.[id]?.label ?? DEFAULT_LAYOUTS[id]?.label ?? id
}

function themeIds(config: MenuConfig): string[] {
  return Object.keys(config.themes ?? DEFAULT_THEMES)
}

function itemName(item: MenuItem, index: number): string {
  return item.label || item.id || `Item ${index + 1}`
}

function previewContent(preview: MenuPreview | undefined): MenuPreview {
  if (isRecord(preview?.detail)) return preview.detail as MenuPreview
  if (isRecord(preview?.sidePanel)) return preview.sidePanel as MenuPreview
  return preview ?? { type: 'rows', rows: [] }
}

function previewRows(preview: MenuPreview | undefined): string[] {
  return Array.isArray(previewContent(preview).rows) ? previewContent(preview).rows! : []
}

function previewImageSource(preview: MenuPreview | undefined): string {
  const content = previewContent(preview)
  return cleanString(content.src, cleanString(content.image, cleanString(content.asset)))
}

function previewRailText(preview: MenuPreview | undefined, fallback = ''): string {
  const content = previewContent(preview)
  return typeof content.railText === 'string' ? content.railText : fallback
}

function previewRailTextOpacity(preview: MenuPreview | undefined, fallback = 1): number {
  const content = previewContent(preview)
  const value = Number(content.railTextOpacity ?? content.railOpacity ?? fallback)
  return Number.isFinite(value) ? value : fallback
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
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

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

function AudioAssetSelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const normalizedOptions = value && !options.includes(value) ? [value, ...options] : options

  return (
    <SelectInput value={value} onChange={onChange}>
      <option value="">None</option>
      {normalizedOptions.map((id) => (
        <option key={id} value={id}>{id}</option>
      ))}
    </SelectInput>
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

export function MainMenuConfigEditor({ path, properties }: Props) {
  const setObjectPropertyAt = useEditorStore((state) => state.setObjectPropertyAt)
  const registry = useEditorStore((state) => state.registry) as Registry | null
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
  const layouts = config.layouts ?? DEFAULT_LAYOUTS
  const layoutOptions = layoutIds(config)
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
  const audioOptions = useMemo(
    () =>
      Object.entries(registry ?? {})
        .filter(([, entry]) => entry?.type === 'audio')
        .map(([id]) => id)
        .sort((a, b) => a.localeCompare(b)),
    [registry],
  )

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

  function updateLayoutField(layoutId: string, key: keyof MenuLayout, value: string | number) {
    updateConfig((next) => {
      if (!next.layouts) next.layouts = {}
      next.layouts[layoutId] = {
        ...(DEFAULT_LAYOUTS[layoutId] ?? {}),
        ...(next.layouts[layoutId] ?? {}),
        [key]: value,
      }
    })
  }

  function updateLayoutRowX(layoutId: string, index: number, value: number) {
    updateConfig((next) => {
      if (!next.layouts) next.layouts = {}
      const current = normalizeLayout(next.layouts[layoutId] ?? DEFAULT_LAYOUTS[layoutId], layoutId)
      const rowX = [...(current.rowX ?? [])]
      rowX[index] = value
      next.layouts[layoutId] = {
        ...current,
        rowX,
      }
    })
  }

  function updateSystemProperty(key: string, value: string | number | boolean) {
    setObjectPropertyAt(path, `properties.${key}`, value)
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
      const current = previewContent(item.preview)
      const railText = typeof current.railText === 'string' ? current.railText : undefined
      const railTextOpacity = Number(current.railTextOpacity ?? current.railOpacity)
      const railProps = {
        ...(railText !== undefined ? { railText } : {}),
        ...(Number.isFinite(railTextOpacity) ? { railTextOpacity } : {}),
      }
      if (type === 'rows') {
        item.preview = { type, rows: previewRows(current), ...railProps }
      } else if (type === 'image') {
        item.preview = { type, src: previewImageSource(current), ...railProps }
      } else if (type === 'toggles') {
        item.preview = { type, label: current.label ?? item.label ?? 'Option', value: current.value ?? 'ON', ...railProps }
      } else {
        item.preview = { type, ...railProps }
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
  const systemString = (key: string, fallback: string) => cleanString(properties[key], fallback)
  const systemNumber = (key: string, fallback: number) => {
    const value = Number(properties[key] ?? fallback)
    return Number.isFinite(value) ? value : fallback
  }
  const systemBoolean = (key: string, fallback: boolean) => {
    const value = properties[key]
    return typeof value === 'boolean' ? value : fallback
  }
  const layoutForEditor = (layoutId: string) => layouts[layoutId] ?? DEFAULT_LAYOUTS[layoutId] ?? { label: layoutId, itemCount: 5 }
  const layoutRowCount = (layoutId: string) => Math.max(1, Math.min(5, Math.round(cleanNumber(layoutForEditor(layoutId).itemCount, 5))))
  const layoutNumber = (layoutId: string, key: keyof MenuLayout, fallback: number) => cleanNumber(layoutForEditor(layoutId)[key], fallback)
  const layoutRowX = (layoutId: string, index: number) => {
    const layout = layoutForEditor(layoutId)
    return cleanNumber(layout.rowX?.[index], DEFAULT_LAYOUTS[layoutId]?.rowX?.[index] ?? 0)
  }
  const selectedPreview = selectedItem ? previewContent(selectedItem.preview) : { type: 'empty' }
  const selectedPreviewRows = previewRows(selectedPreview)
  const sideContentYFallback = selectedPreviewRows.length > 3 ? 404 : DEFAULT_SIDE_PREVIEW.sideContentY
  const sideLineHeightFallback = selectedPreviewRows.length > 4 ? 54 : DEFAULT_SIDE_PREVIEW.sideLineHeight

  if (!hasInlineConfig && !loadedConfig && !loadError) {
    return (
      <InspectorSection title="Authoring Context" collapsible>
        <p className="px-1 py-1 text-[11px] text-gray-500">Loading menu data...</p>
      </InspectorSection>
    )
  }

  return (
    <>
      <InspectorSection title="Menu Graph" collapsible>
        {loadError && (
          <p className="mb-1.5 rounded-sm border border-[#6e3a3a] bg-[#2a1717] px-2 py-1 text-[11px] text-[#ffb8b8]">
            {loadError}
          </p>
        )}
        <CollapsibleSubsection title="Authoring" defaultOpen>
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
          <FieldRow label="Config URL">
            <TextInput value={configUrl} onChange={(value) => updateSystemProperty('config', value)} />
          </FieldRow>
          <FieldRow label="Start Row">
            <RangedInput
              value={systemNumber('initial-selected-index', DEFAULT_AUTHORING.initialSelectedIndex)}
              min={1}
              max={5}
              step={1}
              onChange={(value) => updateSystemProperty('initial-selected-index', Math.round(value))}
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Selected Menu" defaultOpen>
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
            {layoutOptions.map((id) => (
              <option key={id} value={id}>{layoutLabel(config, id)}</option>
            ))}
          </SelectInput>
        </FieldRow>

        <CollapsibleSubsection title="Items" defaultOpen>
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
              <CollapsibleSubsection title="Row Content" defaultOpen>
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
              </CollapsibleSubsection>

              <CollapsibleSubsection title="Presentation">
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
              </CollapsibleSubsection>

              <CollapsibleSubsection title="Sidebar Preview" defaultOpen>
                <FieldRow label="Preview">
                  <SelectInput value={selectedPreview.type ?? 'empty'} onChange={setPreviewType}>
                    {PREVIEW_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </SelectInput>
                </FieldRow>
                {(selectedPreview.type ?? 'empty') === 'rows' && (
                  <FieldRow label="Rows">
                    <textarea
                      value={previewRows(selectedPreview).join('\n')}
                      onChange={(event) => updateItem((item) => {
                        item.preview = { ...previewContent(item.preview), type: 'rows', rows: rowsFromText(event.target.value) }
                      })}
                      rows={4}
                      className={`${INPUT_CLASS} resize-y leading-snug`}
                    />
                  </FieldRow>
                )}
                {selectedPreview.type === 'image' && (
                  <FieldRow label="Image">
                    <TextInput
                      value={previewImageSource(selectedPreview)}
                      onChange={(value) => updateItem((item) => {
                        item.preview = { ...previewContent(item.preview), type: 'image', src: value }
                      })}
                    />
                  </FieldRow>
                )}
                {selectedPreview.type === 'toggles' && (
                  <>
                    <FieldRow label="Toggle">
                      <TextInput
                        value={selectedPreview.label ?? ''}
                        onChange={(value) => updateItem((item) => {
                          item.preview = { ...previewContent(item.preview), type: 'toggles', label: value }
                        })}
                      />
                    </FieldRow>
                    <FieldRow label="Value">
                      <TextInput
                        value={selectedPreview.value ?? ''}
                        onChange={(value) => updateItem((item) => {
                          item.preview = { ...previewContent(item.preview), type: 'toggles', value }
                        })}
                      />
                    </FieldRow>
                  </>
                )}
                <FieldRow label="Rail Text">
                  <TextInput
                    value={previewRailText(selectedItem.preview, selectedItem.label ?? '')}
                    onChange={(value) => updateItem((item) => {
                      item.preview = { ...previewContent(item.preview), railText: value }
                    })}
                  />
                </FieldRow>
                <FieldRow label="Rail Opacity">
                  <RangedInput
                    value={previewRailTextOpacity(selectedItem.preview, 1)}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updateItem((item) => {
                      item.preview = { ...previewContent(item.preview), railTextOpacity: value }
                    })}
                  />
                </FieldRow>
              </CollapsibleSubsection>
            </>
          )}
        </CollapsibleSubsection>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Menu Border" collapsible defaultOpen={false}>
        <CollapsibleSubsection title="Frame" defaultOpen>
          <CollapsibleSubsection title="Motion">
            <FieldRow label="Color Fade">
              <RangedInput
                value={systemNumber('theme-transition-ms', DEFAULT_MOTION.themeTransitionMs)}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('theme-transition-ms', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Title" defaultOpen>
          <CollapsibleSubsection title="Geometry" defaultOpen>
            <FieldRow label="Box X">
              <RangedInput
                value={systemNumber('title-x', DEFAULT_SHIELD_TEXT.titleX)}
                min={0}
                max={1440}
                step={1}
                onChange={(value) => updateSystemProperty('title-x', value)}
              />
            </FieldRow>
            <FieldRow label="Center Y">
              <RangedInput
                value={systemNumber('title-y', DEFAULT_SHIELD_TEXT.titleY)}
                min={0}
                max={1080}
                step={1}
                onChange={(value) => updateSystemProperty('title-y', value)}
              />
            </FieldRow>
            <FieldRow label="Box Width">
              <RangedInput
                value={systemNumber('title-box-width', DEFAULT_SHIELD_TEXT.titleBoxWidth)}
                min={80}
                max={900}
                step={1}
                onChange={(value) => updateSystemProperty('title-box-width', value)}
              />
            </FieldRow>
            <FieldRow label="Box Height">
              <RangedInput
                value={systemNumber('title-box-height', DEFAULT_SHIELD_TEXT.titleBoxHeight)}
                min={24}
                max={220}
                step={1}
                onChange={(value) => updateSystemProperty('title-box-height', value)}
              />
            </FieldRow>
            <FieldRow label="Pad X">
              <RangedInput
                value={systemNumber('title-fit-padding-x', DEFAULT_SHIELD_TEXT.titleFitPaddingX)}
                min={0}
                max={120}
                step={1}
                onChange={(value) => updateSystemProperty('title-fit-padding-x', value)}
              />
            </FieldRow>
            <FieldRow label="Pad Y">
              <RangedInput
                value={systemNumber('title-fit-padding-y', DEFAULT_SHIELD_TEXT.titleFitPaddingY)}
                min={0}
                max={80}
                step={1}
                onChange={(value) => updateSystemProperty('title-fit-padding-y', value)}
              />
            </FieldRow>
            <FieldRow label="Size">
              <RangedInput
                value={systemNumber('title-font-size', DEFAULT_SHIELD_TEXT.titleFontSize)}
                min={24}
                max={120}
                step={1}
                onChange={(value) => updateSystemProperty('title-font-size', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Styling">
            <FieldRow label="Text Color">
              <ColorInput value={menuThemingString('titleTextColor')} onChange={(value) => updateMenuThemingField('titleTextColor', value)} />
            </FieldRow>
            <FieldRow label="Text Opacity">
              <RangedInput
                value={menuThemingNumber('titleTextOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('titleTextOpacity', value)}
              />
            </FieldRow>
            <FieldRow label="Glow Size">
              <RangedInput
                value={menuThemingNumber('titleTextGlowSize')}
                min={0}
                max={40}
                step={0.5}
                onChange={(value) => updateMenuThemingField('titleTextGlowSize', value)}
              />
            </FieldRow>
            <FieldRow label="Glow Alpha">
              <RangedInput
                value={menuThemingNumber('titleTextGlowOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('titleTextGlowOpacity', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Motion">
            <FieldRow label="Duration">
              <RangedInput
                value={systemNumber('title-prism-ms', DEFAULT_MOTION.titlePrismMs)}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('title-prism-ms', value)}
              />
            </FieldRow>
            <FieldRow label="Depth">
              <RangedInput
                value={systemNumber('title-prism-depth', DEFAULT_MOTION.titlePrismDepth)}
                min={0}
                max={220}
                step={1}
                onChange={(value) => updateSystemProperty('title-prism-depth', value)}
              />
            </FieldRow>
            <FieldRow label="Back Lift">
              <RangedInput
                value={systemNumber('title-prism-lift', DEFAULT_MOTION.titlePrismLift)}
                min={0}
                max={160}
                step={1}
                onChange={(value) => updateSystemProperty('title-prism-lift', value)}
              />
            </FieldRow>
            <FieldRow label="Perspective">
              <RangedInput
                value={systemNumber('title-prism-perspective', DEFAULT_MOTION.titlePrismPerspective)}
                min={220}
                max={1600}
                step={10}
                onChange={(value) => updateSystemProperty('title-prism-perspective', value)}
              />
            </FieldRow>
            <FieldRow label="Face Angle">
              <RangedInput
                value={systemNumber('title-prism-angle', DEFAULT_MOTION.titlePrismAngle)}
                min={60}
                max={150}
                step={1}
                onChange={(value) => updateSystemProperty('title-prism-angle', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Caption Box">
          <CollapsibleSubsection title="Geometry" defaultOpen>
            <FieldRow label="Center Text">
              <input
                type="checkbox"
                checked={systemBoolean('caption-center-in-box', DEFAULT_SHIELD_TEXT.captionCenterInBox)}
                onChange={(event) => updateSystemProperty('caption-center-in-box', event.target.checked)}
                className="accent-[#4a8fc2]"
              />
            </FieldRow>
            <FieldRow label="Text X">
              <RangedInput
                value={systemNumber('caption-x', DEFAULT_SHIELD_TEXT.captionX)}
                min={0}
                max={1440}
                step={1}
                onChange={(value) => updateSystemProperty('caption-x', value)}
              />
            </FieldRow>
            <FieldRow label="Text Y">
              <RangedInput
                value={systemNumber('caption-y', DEFAULT_SHIELD_TEXT.captionY)}
                min={0}
                max={1080}
                step={1}
                onChange={(value) => updateSystemProperty('caption-y', value)}
              />
            </FieldRow>
            <FieldRow label="Text Size">
              <RangedInput
                value={systemNumber('caption-font-size', DEFAULT_SHIELD_TEXT.captionFontSize)}
                min={18}
                max={90}
                step={1}
                onChange={(value) => updateSystemProperty('caption-font-size', value)}
              />
            </FieldRow>
            <FieldRow label="Box X">
              <RangedInput
                value={systemNumber('caption-box-x', DEFAULT_SHIELD_TEXT.captionBoxX)}
                min={0}
                max={1440}
                step={1}
                onChange={(value) => updateSystemProperty('caption-box-x', value)}
              />
            </FieldRow>
            <FieldRow label="Box Y">
              <RangedInput
                value={systemNumber('caption-box-y', DEFAULT_SHIELD_TEXT.captionBoxY)}
                min={0}
                max={1080}
                step={1}
                onChange={(value) => updateSystemProperty('caption-box-y', value)}
              />
            </FieldRow>
            <FieldRow label="Box Width">
              <RangedInput
                value={systemNumber('caption-box-width', DEFAULT_SHIELD_TEXT.captionBoxWidth)}
                min={200}
                max={1200}
                step={1}
                onChange={(value) => updateSystemProperty('caption-box-width', value)}
              />
            </FieldRow>
            <FieldRow label="Box Height">
              <RangedInput
                value={systemNumber('caption-box-height', DEFAULT_SHIELD_TEXT.captionBoxHeight)}
                min={40}
                max={180}
                step={1}
                onChange={(value) => updateSystemProperty('caption-box-height', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Styling">
            <FieldRow label="Text Color">
              <ColorInput value={menuThemingString('captionTextColor')} onChange={(value) => updateMenuThemingField('captionTextColor', value)} />
            </FieldRow>
            <FieldRow label="Show Boxes">
              <input
                type="checkbox"
                checked={systemBoolean('shield-text-debug', DEFAULT_SHIELD_TEXT.shieldTextDebug)}
                onChange={(event) => updateSystemProperty('shield-text-debug', event.target.checked)}
                className="accent-[#4a8fc2]"
              />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Motion">
            <FieldRow label="Fade">
              <RangedInput
                value={systemNumber('caption-transition-ms', DEFAULT_MOTION.captionFadeMs)}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('caption-transition-ms', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Back Button">
          <FieldRow label="Back X">
            <RangedInput
              value={systemNumber('back-button-x', DEFAULT_DETAIL_PREVIEW.backButtonX)}
              min={0}
              max={1440}
              step={1}
              onChange={(value) => updateSystemProperty('back-button-x', value)}
            />
          </FieldRow>
          <FieldRow label="Back Y">
            <RangedInput
              value={systemNumber('back-button-y', DEFAULT_DETAIL_PREVIEW.backButtonY)}
              min={0}
              max={1080}
              step={1}
              onChange={(value) => updateSystemProperty('back-button-y', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Menu Item List" collapsible defaultOpen={false}>
        <CollapsibleSubsection title="Stack" defaultOpen>
          <FieldRow label="X Offset">
            <RangedInput
              value={systemNumber('menu-x-offset', DEFAULT_STACK_TUNING.menuXOffset)}
              min={-300}
              max={300}
              step={1}
              onChange={(value) => updateSystemProperty('menu-x-offset', value)}
            />
          </FieldRow>
          <FieldRow label="Y Offset">
            <RangedInput
              value={systemNumber('menu-y-offset', DEFAULT_STACK_TUNING.menuYOffset)}
              min={-300}
              max={300}
              step={1}
              onChange={(value) => updateSystemProperty('menu-y-offset', value)}
            />
          </FieldRow>
          <FieldRow label="Scale">
            <RangedInput
              value={systemNumber('menu-scale', DEFAULT_STACK_TUNING.menuScale)}
              min={0.5}
              max={1.5}
              step={0.01}
              onChange={(value) => updateSystemProperty('menu-scale', value)}
            />
          </FieldRow>
          <FieldRow label="Width">
            <RangedInput
              value={systemNumber('menu-width-scale', DEFAULT_STACK_TUNING.menuWidthScale)}
              min={0.6}
              max={1.4}
              step={0.01}
              onChange={(value) => updateSystemProperty('menu-width-scale', value)}
            />
          </FieldRow>
          <FieldRow label="Font">
            <RangedInput
              value={systemNumber('menu-font-scale', DEFAULT_STACK_TUNING.menuFontScale)}
              min={0.6}
              max={1.4}
              step={0.01}
              onChange={(value) => updateSystemProperty('menu-font-scale', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Layout Presets">
          {layoutOptions.map((layoutId) => (
            <CollapsibleSubsection key={layoutId} title={layoutLabel(config, layoutId)}>
              <FieldRow label="Start Y">
                <RangedInput
                  value={layoutNumber(layoutId, 'yStart', DEFAULT_LAYOUTS[layoutId]?.yStart ?? 274)}
                  min={0}
                  max={1080}
                  step={1}
                  onChange={(value) => updateLayoutField(layoutId, 'yStart', value)}
                />
              </FieldRow>
              <FieldRow label="Spacing">
                <RangedInput
                  value={layoutNumber(layoutId, 'spacing', DEFAULT_LAYOUTS[layoutId]?.spacing ?? 119)}
                  min={0}
                  max={260}
                  step={1}
                  onChange={(value) => updateLayoutField(layoutId, 'spacing', value)}
                />
              </FieldRow>
              <FieldRow label="Width">
                <RangedInput
                  value={layoutNumber(layoutId, 'rowWidth', DEFAULT_LAYOUTS[layoutId]?.rowWidth ?? 760)}
                  min={240}
                  max={1200}
                  step={1}
                  onChange={(value) => updateLayoutField(layoutId, 'rowWidth', value)}
                />
              </FieldRow>
              {Array.from({ length: layoutRowCount(layoutId) }, (_, index) => (
                <FieldRow key={`${layoutId}-row-${index + 1}-x`} label={`Row ${index + 1} X`}>
                  <RangedInput
                    value={layoutRowX(layoutId, index)}
                    min={-400}
                    max={1440}
                    step={1}
                    onChange={(value) => updateLayoutRowX(layoutId, index, value)}
                  />
                </FieldRow>
              ))}
            </CollapsibleSubsection>
          ))}
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Rows">
          <CollapsibleSubsection title="Styling" defaultOpen>
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

          <CollapsibleSubsection title="Edge Falloff">
            <FieldRow label="Edge Alpha">
              <RangedInput
                value={menuThemingNumber('rowEdgeOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('rowEdgeOpacity', value)}
              />
            </FieldRow>
            <FieldRow label="Edge Feather">
              <RangedInput
                value={menuThemingNumber('rowEdgeFeather')}
                min={0}
                max={8}
                step={0.1}
                onChange={(value) => updateMenuThemingField('rowEdgeFeather', value)}
              />
            </FieldRow>
            <FieldRow label="Glow Size">
              <RangedInput
                value={menuThemingNumber('rowEdgeGlowSize')}
                min={0}
                max={48}
                step={0.5}
                onChange={(value) => updateMenuThemingField('rowEdgeGlowSize', value)}
              />
            </FieldRow>
            <FieldRow label="Glow Alpha">
              <RangedInput
                value={menuThemingNumber('rowEdgeGlowOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('rowEdgeGlowOpacity', value)}
              />
            </FieldRow>
            <FieldRow label="Selected Alpha">
              <RangedInput
                value={menuThemingNumber('rowSelectedEdgeOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('rowSelectedEdgeOpacity', value)}
              />
            </FieldRow>
            <FieldRow label="Selected Feather">
              <RangedInput
                value={menuThemingNumber('rowSelectedEdgeFeather')}
                min={0}
                max={8}
                step={0.1}
                onChange={(value) => updateMenuThemingField('rowSelectedEdgeFeather', value)}
              />
            </FieldRow>
            <FieldRow label="Selected Glow">
              <RangedInput
                value={menuThemingNumber('rowSelectedEdgeGlowSize')}
                min={0}
                max={64}
                step={0.5}
                onChange={(value) => updateMenuThemingField('rowSelectedEdgeGlowSize', value)}
              />
            </FieldRow>
            <FieldRow label="Selected Glow Alpha">
              <RangedInput
                value={menuThemingNumber('rowSelectedEdgeGlowOpacity')}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateMenuThemingField('rowSelectedEdgeGlowOpacity', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Motion">
            <FieldRow label="Target Fade">
              <RangedInput
                value={systemNumber('selection-target-fade-ms', DEFAULT_MOTION.targetFadeMs)}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('selection-target-fade-ms', value)}
              />
            </FieldRow>
            <FieldRow label="Row Color">
              <RangedInput
                value={systemNumber(
                  'menu-item-color-transition-ms',
                  systemNumber('selection-target-fade-ms', DEFAULT_MOTION.menuItemColorMs),
                )}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('menu-item-color-transition-ms', value)}
              />
            </FieldRow>
            <FieldRow label="Forward/Back">
              <RangedInput
                value={systemNumber('transition-ms', DEFAULT_MOTION.transitionMs)}
                min={0}
                max={2000}
                step={10}
                onChange={(value) => updateSystemProperty('transition-ms', value)}
              />
            </FieldRow>
            <FieldRow label="Orbit Radius">
              <RangedInput
                value={systemNumber('menu-orbit-radius', DEFAULT_MOTION.orbitRadius)}
                min={120}
                max={1800}
                step={5}
                onChange={(value) => updateSystemProperty('menu-orbit-radius', value)}
              />
            </FieldRow>
            <FieldRow label="Orbit Angle">
              <RangedInput
                value={systemNumber('menu-orbit-angle', DEFAULT_MOTION.orbitAngle)}
                min={0}
                max={180}
                step={1}
                onChange={(value) => updateSystemProperty('menu-orbit-angle', value)}
              />
            </FieldRow>
            <FieldRow label="Easing">
              <SelectInput
                value={systemString('menu-motion-easing', DEFAULT_MOTION.easing)}
                onChange={(value) => updateSystemProperty('menu-motion-easing', value)}
              >
                {MOTION_EASING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectInput>
            </FieldRow>
            <FieldRow label="Show Guide">
              <input
                type="checkbox"
                checked={systemBoolean('menu-orbit-debug', DEFAULT_MOTION.orbitDebug)}
                onChange={(event) => updateSystemProperty('menu-orbit-debug', event.target.checked)}
                className="accent-[#4a8fc2]"
              />
            </FieldRow>
            <FieldRow label="Guide Center X">
              <RangedInput
                value={systemNumber('menu-orbit-center-x', DEFAULT_MOTION.orbitCenterX)}
                min={-1440}
                max={2880}
                step={1}
                onChange={(value) => updateSystemProperty('menu-orbit-center-x', value)}
              />
            </FieldRow>
            <FieldRow label="Guide Center Y">
              <RangedInput
                value={systemNumber('menu-orbit-center-y', DEFAULT_MOTION.orbitCenterY)}
                min={-1080}
                max={2160}
                step={1}
                onChange={(value) => updateSystemProperty('menu-orbit-center-y', value)}
              />
            </FieldRow>
            <FieldRow label="Guide Opacity">
              <RangedInput
                value={systemNumber('menu-orbit-debug-opacity', DEFAULT_MOTION.orbitDebugOpacity)}
                min={0}
                max={1}
                step={0.01}
                onChange={(value) => updateSystemProperty('menu-orbit-debug-opacity', value)}
              />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Target Marker">
          <CollapsibleSubsection title="Pulse Styling" defaultOpen>
            <FieldRow label="Pulse">
              <ColorInput value={menuThemingString('markerPulseColor')} onChange={(value) => updateMenuThemingField('markerPulseColor', value)} />
            </FieldRow>
            <FieldRow label="Radius">
              <RangedInput value={menuThemingNumber('markerPulseRadius')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseRadius', value)} />
            </FieldRow>
            <FieldRow label="Target">
              <RangedInput value={menuThemingNumber('markerPulseTargetRadius')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseTargetRadius', value)} />
            </FieldRow>
            <FieldRow label="Opacity">
              <RangedInput value={menuThemingNumber('markerPulseOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerPulseOpacity', value)} />
            </FieldRow>
            <FieldRow label="Thickness">
              <RangedInput value={menuThemingNumber('markerPulseThickness')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseThickness', value)} />
            </FieldRow>
            <FieldRow label="Feather">
              <RangedInput value={menuThemingNumber('markerPulseFeatherWidth')} min={0} max={20} step={0.1} onChange={(value) => updateMenuThemingField('markerPulseFeatherWidth', value)} />
            </FieldRow>
            <FieldRow label="Edge Opacity">
              <RangedInput value={menuThemingNumber('markerPulseEdgeOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerPulseEdgeOpacity', value)} />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Ring Glow">
            <FieldRow label="Ring Glow">
              <RangedInput value={menuThemingNumber('markerRingGlowSize')} min={0} max={8} step={0.1} onChange={(value) => updateMenuThemingField('markerRingGlowSize', value)} />
            </FieldRow>
            <FieldRow label="Ring Alpha">
              <RangedInput value={menuThemingNumber('markerRingGlowOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerRingGlowOpacity', value)} />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Inner Pulse">
            <FieldRow label="Inner Color">
              <ColorInput value={menuThemingString('markerInnerPulseColor')} onChange={(value) => updateMenuThemingField('markerInnerPulseColor', value)} />
            </FieldRow>
            <FieldRow label="Inner Size">
              <RangedInput value={menuThemingNumber('markerInnerPulseRadius')} min={0} max={120} step={1} onChange={(value) => updateMenuThemingField('markerInnerPulseRadius', value)} />
            </FieldRow>
            <FieldRow label="Inner Alpha">
              <RangedInput value={menuThemingNumber('markerInnerPulseOpacity')} min={0} max={1} step={0.01} onChange={(value) => updateMenuThemingField('markerInnerPulseOpacity', value)} />
            </FieldRow>
            <FieldRow label="Inner Glow">
              <RangedInput value={menuThemingNumber('markerInnerPulseGlowSize')} min={0} max={80} step={1} onChange={(value) => updateMenuThemingField('markerInnerPulseGlowSize', value)} />
            </FieldRow>
          </CollapsibleSubsection>

          <CollapsibleSubsection title="Motion">
            <FieldRow label="Pulse Speed">
              <RangedInput value={menuThemingNumber('markerContractSpeed')} min={0} max={12} step={0.1} onChange={(value) => updateMenuThemingField('markerContractSpeed', value)} />
            </FieldRow>
            <FieldRow label="Inner Speed">
              <RangedInput value={menuThemingNumber('markerInnerPulseSpeed')} min={0} max={12} step={0.1} onChange={(value) => updateMenuThemingField('markerInnerPulseSpeed', value)} />
            </FieldRow>
            <FieldRow label="Single Cool">
              <RangedInput value={menuThemingNumber('markerSingleCooldown')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerSingleCooldown', value)} />
            </FieldRow>
            <FieldRow label="Double Cool">
              <RangedInput value={menuThemingNumber('markerDoubleCooldown')} min={0} max={10} step={0.1} onChange={(value) => updateMenuThemingField('markerDoubleCooldown', value)} />
            </FieldRow>
            <FieldRow label="Double Gap">
              <RangedInput value={menuThemingNumber('markerDoubleGap')} min={0} max={3} step={0.01} onChange={(value) => updateMenuThemingField('markerDoubleGap', value)} />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Audio">
          <FieldRow label="Navigation">
            <AudioAssetSelect
              value={systemString('ui-navigation-sound', DEFAULT_AUDIO.navigationSound)}
              options={audioOptions}
              onChange={(value) => updateSystemProperty('ui-navigation-sound', value)}
            />
          </FieldRow>
          <FieldRow label="Level">
            <RangedInput
              value={systemNumber('ui-navigation-volume', DEFAULT_AUDIO.navigationVolume)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('ui-navigation-volume', value)}
            />
          </FieldRow>
          <FieldRow label="Forward">
            <AudioAssetSelect
              value={systemString('ui-forward-sound', DEFAULT_AUDIO.forwardSound)}
              options={audioOptions}
              onChange={(value) => updateSystemProperty('ui-forward-sound', value)}
            />
          </FieldRow>
          <FieldRow label="Level">
            <RangedInput
              value={systemNumber('ui-forward-volume', DEFAULT_AUDIO.forwardVolume)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('ui-forward-volume', value)}
            />
          </FieldRow>
          <FieldRow label="Back">
            <AudioAssetSelect
              value={systemString('ui-back-sound', DEFAULT_AUDIO.backSound)}
              options={audioOptions}
              onChange={(value) => updateSystemProperty('ui-back-sound', value)}
            />
          </FieldRow>
          <FieldRow label="Level">
            <RangedInput
              value={systemNumber('ui-back-volume', DEFAULT_AUDIO.backVolume)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('ui-back-volume', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Sidebar" collapsible defaultOpen={false}>
        <CollapsibleSubsection title="Panel" defaultOpen>
          <FieldRow label="Panel X">
            <RangedInput
              value={systemNumber('side-x', DEFAULT_SIDE_PREVIEW.sideX)}
              min={-300}
              max={400}
              step={1}
              onChange={(value) => updateSystemProperty('side-x', value)}
            />
          </FieldRow>
          <FieldRow label="Panel Y">
            <RangedInput
              value={systemNumber('side-y', DEFAULT_SIDE_PREVIEW.sideY)}
              min={-300}
              max={400}
              step={1}
              onChange={(value) => updateSystemProperty('side-y', value)}
            />
          </FieldRow>
          <FieldRow label="Scale">
            <RangedInput
              value={systemNumber('side-scale', DEFAULT_SIDE_PREVIEW.sideScale)}
              min={0.5}
              max={1.5}
              step={0.01}
              onChange={(value) => updateSystemProperty('side-scale', value)}
            />
          </FieldRow>
          <FieldRow label="Perspective">
            <RangedInput
              value={systemNumber('side-perspective', DEFAULT_SIDE_PREVIEW.sidePerspective)}
              min={500}
              max={3000}
              step={10}
              onChange={(value) => updateSystemProperty('side-perspective', value)}
            />
          </FieldRow>
          <FieldRow label="Opacity">
            <RangedInput
              value={systemNumber('side-panel-opacity', DEFAULT_SIDE_PREVIEW.sidePanelOpacity)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('side-panel-opacity', value)}
            />
          </FieldRow>
          <FieldRow label="Gray Border">
            <input
              type="checkbox"
              checked={systemBoolean('side-frame-visible', DEFAULT_SIDE_PREVIEW.sideFrameVisible)}
              onChange={(event) => updateSystemProperty('side-frame-visible', event.target.checked)}
              className="accent-[#4a8fc2]"
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Rain">
          <FieldRow label="Density">
            <RangedInput
              value={systemNumber('side-rain-density', DEFAULT_SIDE_PREVIEW.sideRainDensity)}
              min={0}
              max={160}
              step={1}
              onChange={(value) => updateSystemProperty('side-rain-density', value)}
            />
          </FieldRow>
          <FieldRow label="Speed">
            <RangedInput
              value={systemNumber('side-rain-speed', DEFAULT_SIDE_PREVIEW.sideRainSpeed)}
              min={0.05}
              max={5}
              step={0.05}
              onChange={(value) => updateSystemProperty('side-rain-speed', value)}
            />
          </FieldRow>
          <FieldRow label="White Offset">
            <RangedInput
              value={systemNumber('side-rain-color-offset', DEFAULT_SIDE_PREVIEW.sideRainColorOffset)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('side-rain-color-offset', value)}
            />
          </FieldRow>
          <FieldRow label="X Scale">
            <RangedInput
              value={systemNumber('side-rain-x-scale', DEFAULT_SIDE_PREVIEW.sideRainXScale)}
              min={0.1}
              max={8}
              step={0.05}
              onChange={(value) => updateSystemProperty('side-rain-x-scale', value)}
            />
          </FieldRow>
          <FieldRow label="Y Scale">
            <RangedInput
              value={systemNumber('side-rain-y-scale', DEFAULT_SIDE_PREVIEW.sideRainYScale)}
              min={0.1}
              max={8}
              step={0.05}
              onChange={(value) => updateSystemProperty('side-rain-y-scale', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Preview Text">
          <FieldRow label="Text Color">
            <ColorInput value={menuThemingString('sideTextColor')} onChange={(value) => updateMenuThemingField('sideTextColor', value)} />
          </FieldRow>
          <FieldRow label="Text X">
            <RangedInput
              value={systemNumber('side-content-x', DEFAULT_SIDE_PREVIEW.sideContentX)}
              min={0}
              max={1440}
              step={1}
              onChange={(value) => updateSystemProperty('side-content-x', value)}
            />
          </FieldRow>
          <FieldRow label="Text Y">
            <RangedInput
              value={systemNumber('side-content-y', sideContentYFallback)}
              min={0}
              max={1080}
              step={1}
              onChange={(value) => updateSystemProperty('side-content-y', value)}
            />
          </FieldRow>
          <FieldRow label="Text Width">
            <RangedInput
              value={systemNumber('side-content-width', DEFAULT_SIDE_PREVIEW.sideContentWidth)}
              min={80}
              max={600}
              step={1}
              onChange={(value) => updateSystemProperty('side-content-width', value)}
            />
          </FieldRow>
          <FieldRow label="Line Height">
            <RangedInput
              value={systemNumber('side-line-height', sideLineHeightFallback)}
              min={24}
              max={120}
              step={1}
              onChange={(value) => updateSystemProperty('side-line-height', value)}
            />
          </FieldRow>
          <FieldRow label="Font">
            <RangedInput
              value={systemNumber('side-font-scale', DEFAULT_SIDE_PREVIEW.sideFontScale)}
              min={0.6}
              max={1.4}
              step={0.01}
              onChange={(value) => updateSystemProperty('side-font-scale', value)}
            />
          </FieldRow>
          <FieldRow label="Text Opacity">
            <RangedInput
              value={systemNumber('side-text-opacity', DEFAULT_SIDE_PREVIEW.sideTextOpacity)}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateSystemProperty('side-text-opacity', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Left Rail">
          <FieldRow label="Visible">
            <input
              type="checkbox"
              checked={systemBoolean('side-rail-visible', DEFAULT_SIDE_PREVIEW.sideRailVisible)}
              onChange={(event) => updateSystemProperty('side-rail-visible', event.target.checked)}
              className="accent-[#4a8fc2]"
            />
          </FieldRow>
          <FieldRow label="Rail Color">
            <ColorInput value={menuThemingString('railTextColor')} onChange={(value) => updateMenuThemingField('railTextColor', value)} />
          </FieldRow>
          <FieldRow label="Rail X">
            <RangedInput
              value={systemNumber('side-rail-x', DEFAULT_SIDE_PREVIEW.sideRailX)}
              min={0}
              max={1440}
              step={1}
              onChange={(value) => updateSystemProperty('side-rail-x', value)}
            />
          </FieldRow>
          <FieldRow label="Rail Y">
            <RangedInput
              value={systemNumber('side-rail-y', DEFAULT_SIDE_PREVIEW.sideRailY)}
              min={0}
              max={1080}
              step={1}
              onChange={(value) => updateSystemProperty('side-rail-y', value)}
            />
          </FieldRow>
          <FieldRow label="Rail Rotation">
            <RangedInput
              value={systemNumber('side-rail-rotation', DEFAULT_SIDE_PREVIEW.sideRailRotation)}
              min={-180}
              max={180}
              step={1}
              onChange={(value) => updateSystemProperty('side-rail-rotation', value)}
            />
          </FieldRow>
          <FieldRow label="Rail Font">
            <RangedInput
              value={systemNumber('side-rail-font-size', DEFAULT_SIDE_PREVIEW.sideRailFontSize)}
              min={12}
              max={80}
              step={1}
              onChange={(value) => updateSystemProperty('side-rail-font-size', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>

        <CollapsibleSubsection title="Detail Object">
          <FieldRow label="Detail X">
            <RangedInput
              value={systemNumber('detail-x', DEFAULT_DETAIL_PREVIEW.detailX)}
              min={0}
              max={1440}
              step={1}
              onChange={(value) => updateSystemProperty('detail-x', value)}
            />
          </FieldRow>
          <FieldRow label="Detail Y">
            <RangedInput
              value={systemNumber('detail-y', DEFAULT_DETAIL_PREVIEW.detailY)}
              min={0}
              max={1080}
              step={1}
              onChange={(value) => updateSystemProperty('detail-y', value)}
            />
          </FieldRow>
          <FieldRow label="Detail W">
            <RangedInput
              value={systemNumber('detail-width', DEFAULT_DETAIL_PREVIEW.detailWidth)}
              min={160}
              max={900}
              step={1}
              onChange={(value) => updateSystemProperty('detail-width', value)}
            />
          </FieldRow>
          <FieldRow label="Wide X">
            <RangedInput
              value={systemNumber('detail-wide-x', DEFAULT_DETAIL_PREVIEW.detailWideX)}
              min={0}
              max={1440}
              step={1}
              onChange={(value) => updateSystemProperty('detail-wide-x', value)}
            />
          </FieldRow>
          <FieldRow label="Wide Y">
            <RangedInput
              value={systemNumber('detail-wide-y', DEFAULT_DETAIL_PREVIEW.detailWideY)}
              min={0}
              max={1080}
              step={1}
              onChange={(value) => updateSystemProperty('detail-wide-y', value)}
            />
          </FieldRow>
          <FieldRow label="Wide W">
            <RangedInput
              value={systemNumber('detail-wide-width', DEFAULT_DETAIL_PREVIEW.detailWideWidth)}
              min={240}
              max={1000}
              step={1}
              onChange={(value) => updateSystemProperty('detail-wide-width', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Global Defaults" collapsible defaultOpen={false}>
        <CollapsibleSubsection title="Named Themes">
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
          <CollapsibleSubsection title="Border Frame">
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
          </CollapsibleSubsection>
          <CollapsibleSubsection title="Wash">
            <FieldRow label="Wash">
              <TextInput value={activeTheme.wash ?? ''} onChange={(value) => updateThemeField('wash', value)} />
            </FieldRow>
          </CollapsibleSubsection>
        </CollapsibleSubsection>
      </InspectorSection>

      <InspectorSection title="Menu Shell" collapsible defaultOpen={false}>
        <CollapsibleSubsection title="Input" defaultOpen>
          <FieldRow label="Keyboard">
            <input
              type="checkbox"
              checked={systemBoolean('enable-keyboard', true)}
              onChange={(event) => updateSystemProperty('enable-keyboard', event.target.checked)}
              className="accent-[#4a8fc2]"
            />
          </FieldRow>
          <FieldRow label="Gamepad">
            <input
              type="checkbox"
              checked={systemBoolean('enable-gamepad', true)}
              onChange={(event) => updateSystemProperty('enable-gamepad', event.target.checked)}
              className="accent-[#4a8fc2]"
            />
          </FieldRow>
          <FieldRow label="Root Back">
            <TextInput
              value={systemString('back-target', DEFAULT_AUDIO.backTarget)}
              onChange={(value) => updateSystemProperty('back-target', value)}
            />
          </FieldRow>
        </CollapsibleSubsection>
      </InspectorSection>
    </>
  )
}

export default MainMenuConfigEditor
