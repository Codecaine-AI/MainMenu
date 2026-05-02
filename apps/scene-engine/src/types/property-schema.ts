export type PropertyType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'select'
  | 'blend'
  | 'fit'
  | 'clip'
  | 'anchor'

export type SelectOption = string | { value: string; label: string }

export interface NumberPropertyDef {
  type: 'number'
  label: string
  description?: string
  min?: number
  max?: number
  step?: number
}

export interface StringPropertyDef {
  type: 'string'
  label: string
  description?: string
}

export interface BooleanPropertyDef {
  type: 'boolean'
  label: string
  description?: string
}

export interface SelectPropertyDef {
  type: 'select'
  label: string
  description?: string
  options: SelectOption[]
}

export interface BlendPropertyDef {
  type: 'blend'
  label: string
  description?: string
}

export interface FitPropertyDef {
  type: 'fit'
  label: string
  description?: string
}

export interface ClipPropertyDef {
  type: 'clip'
  label: string
  description?: string
}

export interface AnchorPropertyDef {
  type: 'anchor'
  label: string
  description?: string
}

export type PropertyDef =
  | NumberPropertyDef
  | StringPropertyDef
  | BooleanPropertyDef
  | SelectPropertyDef
  | BlendPropertyDef
  | FitPropertyDef
  | ClipPropertyDef
  | AnchorPropertyDef

export interface Section {
  id: string
  label: string
  description?: string
  properties?: Record<string, PropertyDef>
  sections?: Section[]
}

export interface PropertySchema {
  sections: Section[]
}
