// Built-in (non-component) layer property schemas. Effect and component layers
// are intentionally absent — those flow through the per-module manifest path in
// LayerForm.

import { NUMERIC_PROPERTY_STEPS } from '@/lib/inspector-config'
import type { PropertyDef, PropertySchema, Section } from '@/types/property-schema'
import type { SceneObjectType } from '@/types/scene'

const mediaSchema: PropertySchema = {
  sections: [
    {
      id: 'media',
      label: 'Media',
      properties: {
        repeat_x: {
          type: 'number',
          label: 'Repeat X',
          description:
            'Tile the media horizontally — number of horizontal repetitions inside the layer.',
          min: 1,
          max: 40,
          step: 1,
        },
        repeat_y: {
          type: 'number',
          label: 'Repeat Y',
          description:
            'Tile the media vertically — number of vertical repetitions inside the layer.',
          min: 1,
          max: 40,
          step: 1,
        },
        position_x: {
          type: 'number',
          label: 'Position X',
          description:
            'Horizontal offset of the media inside the layer, in percent. 0 is centered; negative shifts left.',
          min: -100,
          max: 100,
          step: 1,
        },
        position_y: {
          type: 'number',
          label: 'Position Y',
          description:
            'Vertical offset of the media inside the layer, in percent. 0 is centered; negative shifts up.',
          min: -100,
          max: 100,
          step: 1,
        },
        scale: {
          type: 'number',
          label: 'Scale',
          description:
            'Uniform scale applied to the media within the layer. 1.0 is natural size.',
          min: 0.1,
          max: 5,
          step: 0.05,
        },
        rotation: {
          type: 'number',
          label: 'Rotation',
          description: 'Rotation of the media inside the layer, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
        speed: {
          type: 'number',
          label: 'Speed',
          description:
            'Playback speed multiplier for video media — 1.0 is normal, lower values play back slower.',
          min: 0.05,
          max: 4,
          step: 0.05,
        },
      },
    },
  ],
}

const glyphGroupSchema: PropertySchema = {
  sections: [
    {
      id: 'glyph-group',
      label: 'Glyph Group',
      properties: {
        shimmer: {
          type: 'boolean',
          label: 'Shimmer',
          description:
            'Apply the animated shimmer/pearlescent gradient overlay to the glyph fills.',
        },
      },
    },
  ],
}

const audioSchema: PropertySchema = {
  sections: [
    {
      id: 'audio',
      label: 'Audio',
      properties: {},
    },
  ],
}

export const BUILTIN_PROPERTY_SCHEMAS: Partial<Record<SceneObjectType, PropertySchema>> = {
  video: mediaSchema,
  image: mediaSchema,
  'glyph-group': glyphGroupSchema,
  audio: audioSchema,
}

export function getBuiltinPropertySchema(
  type: SceneObjectType | undefined,
): PropertySchema | undefined {
  if (!type) return undefined
  return BUILTIN_PROPERTY_SCHEMAS[type]
}

export function extractSchemaPropertyKeys(schema: PropertySchema): Set<string> {
  const keys = new Set<string>()
  function walk(section: Section) {
    for (const key of Object.keys(section.properties ?? {})) keys.add(key)
    for (const child of section.sections ?? []) walk(child)
  }
  for (const section of schema.sections) walk(section)
  return keys
}

const COLOR_RE = new RegExp('^(#[0-9a-fA-F]{3,8}|rgba?\\(|hsla?\\()')

function looksLikeColor(key: string, value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (COLOR_RE.test(value.trim())) return true
  if (/color/i.test(key)) return true
  return false
}

export function inferPropertyDef(key: string, value: unknown): PropertyDef {
  if (typeof value === 'number') {
    const steps = NUMERIC_PROPERTY_STEPS[key]
    if (steps) {
      return { type: 'number', label: key, min: steps.min, max: steps.max, step: steps.step }
    }
    return { type: 'number', label: key }
  }
  if (typeof value === 'boolean') {
    return { type: 'boolean', label: key }
  }
  if (looksLikeColor(key, value)) {
    return { type: 'color', label: key }
  }
  return { type: 'string', label: key }
}

export function buildGeneralSection(orphans: Array<[string, unknown]>): Section {
  return {
    id: 'general',
    label: 'General',
    description:
      "Saved properties not declared in this layer's schema. Update the schema to give them a proper label and description.",
    properties: Object.fromEntries(
      orphans.map(([key, value]) => [key, inferPropertyDef(key, value)]),
    ),
  }
}
