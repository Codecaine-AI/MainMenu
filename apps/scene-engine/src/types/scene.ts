export interface StageDef {
  width: number
  height: number
}

export interface LayerPosition {
  x: string | number
  y: string | number
}

export interface LayerChild {
  id: string
  layer?: string
  type?: string
  asset?: string
  visible?: boolean
  properties?: Record<string, unknown>
}

export interface LayerDef {
  id: string
  type: string
  asset: string
  visible?: boolean
  position?: LayerPosition
  properties?: Record<string, unknown>
  children?: LayerChild[]
}

export interface SceneJson {
  id: string
  name: string
  stage: StageDef
  layers: LayerDef[]
}

export type AssetType = 'audio' | 'image' | 'video' | 'glyph'
export type ModuleType = 'effect' | 'component'

export interface AssetContainer {
  type: AssetType
  file: string
}

export interface ModuleEntry {
  type: ModuleType
  path: string
}

export type Registry = Record<string, AssetContainer | ModuleEntry>
