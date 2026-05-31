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

export type TransformX = number | 'left' | 'center' | 'right'
export type TransformY = number | 'top' | 'center' | 'middle' | 'bottom'

export interface TransformExplicit {
  x: TransformX
  y: TransformY
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

export interface MediaProperties {
  repeat_x?: number
  repeat_y?: number
  position_x?: number
  position_y?: number
  scale?: number
  rotation?: number
  speed?: number
}

export type SlotType = 'video-fill'

export interface VideoFillSlot {
  id: string
  type: 'video-fill'
  asset: string
  appearance?: Appearance
  properties?: MediaProperties
}

export type Slot = VideoFillSlot

export type EventTrigger = 'click' | 'hover' | 'load'
export type EventAction = 'navigate' | 'play-audio' | 'autoplay'

export interface EventBinding {
  trigger: EventTrigger
  action: EventAction
  target?: string
  properties?: Record<string, unknown>
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
  locked?: boolean
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

export type AssetType = 'audio' | 'image' | 'video' | 'glyph' | 'font'
export type ModuleType = 'effect' | 'component'
export type AssetScope = 'global' | 'project'

export interface AssetContainer {
  type: AssetType
  file: string
  label?: string
  scope?: AssetScope
  projectIds?: string[]
  tags?: string[]
  createdAt?: string
  updatedAt?: string
  family?: string
  weight?: number
  style?: string
}

export interface AssetUsageLocation {
  projectId: string
  sceneId: string
  objectId?: string
  slotId?: string
  property?: string
}

export interface AssetLibraryRecord extends AssetContainer {
  id: string
  label: string
  usageCount?: number
  usage?: AssetUsageLocation[]
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
  assetType?: AssetType
  description?: string
}

export interface ManifestColorProperty {
  type: 'color'
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
  | ManifestColorProperty
  | ManifestBooleanProperty
  | ManifestEnumProperty

export interface Manifest {
  name: string
  type: ModuleType
  sizing?: 'fill' | 'explicit'
  aspectRatio?: number
  dependencies?: {
    modules?: string[]
    assets?: string[]
    publicFiles?: string[]
    fonts?: string[]
  }
  properties: Record<string, ManifestProperty>
}

export interface ModuleEntry {
  type: ModuleType
  path: string
  manifest?: Manifest
}

export type Registry = Record<string, AssetContainer | ModuleEntry>

export interface ProjectSceneRef {
  id: string
  name?: string
  active?: boolean
  export?: boolean
}

export interface ProjectManifest {
  id: string
  name: string
  entry: string
  scenes: ProjectSceneRef[]
  stage: StageDef
}

export interface ExportGraphSummary {
  projectId: string
  activeSceneIds: string[]
  assetIds: string[]
  moduleIds: string[]
  fontIds: string[]
  publicFiles: string[]
  warnings: string[]
}
