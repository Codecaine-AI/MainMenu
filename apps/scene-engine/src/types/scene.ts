export interface StageDef {
  width: number
  height: number
}

export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

export interface TransformExplicit {
  x: number
  y: number
  width: number | 'auto'
  height: number | 'auto'
  rotation?: number
  scale?: number
  anchor?: Anchor
  mode?: undefined
}

export interface TransformFill {
  mode: 'fill'
  rotation?: number
  scale?: number
}

export type Transform = TransformExplicit | TransformFill

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity'

export type FitMode = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'

export interface Appearance {
  opacity?: number
  blend?: BlendMode
  hue?: number
  saturation?: number
  fit?: FitMode
}

export type SlotType = 'video-fill'

export interface VideoFillSlot {
  id: string
  type: 'video-fill'
  asset: string
  appearance?: Appearance
}

export type Slot = VideoFillSlot

export type EventTrigger = 'click' | 'hover' | 'load'
export type EventAction = 'navigate' | 'play-audio' | 'autoplay'

export interface EventBinding {
  trigger: EventTrigger
  action: EventAction
  target?: string
}

export type SceneObjectType =
  | 'video'
  | 'image'
  | 'audio'
  | 'glyph-group'
  | 'text'
  | 'effect'
  | 'component'
  | 'group'

export interface SceneObject {
  id: string
  name?: string
  type: SceneObjectType
  asset?: string
  visible?: boolean
  transform: Transform
  appearance?: Appearance
  properties?: Record<string, unknown>
  slots?: Slot[]
  events?: EventBinding[]
  children?: SceneObject[]
}

export interface SceneJson {
  id: string
  name: string
  stage: StageDef
  appearance?: Appearance
  objects: SceneObject[]
}

export type AssetType = 'audio' | 'image' | 'video' | 'glyph'
export type ModuleType = 'effect' | 'component'

export interface AssetContainer {
  type: AssetType
  file: string
}

export interface ManifestNumberProperty {
  type: 'number'
  default?: number
  min?: number
  max?: number
  step?: number
  description?: string
}

export interface ManifestStringProperty {
  type: 'string'
  default?: string
  description?: string
}

export interface ManifestBooleanProperty {
  type: 'boolean'
  default?: boolean
  description?: string
}

export interface ManifestEnumProperty {
  type: 'enum'
  default?: string
  options: string[]
  description?: string
}

export type ManifestProperty =
  | ManifestNumberProperty
  | ManifestStringProperty
  | ManifestBooleanProperty
  | ManifestEnumProperty

export interface Manifest {
  name: string
  type: ModuleType
  sizing?: 'fill' | 'explicit'
  properties: Record<string, ManifestProperty>
}

export interface ModuleEntry {
  type: ModuleType
  path: string
  manifest?: Manifest
}

export type Registry = Record<string, AssetContainer | ModuleEntry>
