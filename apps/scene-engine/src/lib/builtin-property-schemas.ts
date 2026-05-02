// Built-in (non-component) layer property schemas. CP1 ships only the shared
// `media` schema (used for video + image). CP2 will append glyph-group, effect,
// and audio entries to BUILTIN_PROPERTY_SCHEMAS.

import type { PropertySchema } from '@/types/property-schema'
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

export const BUILTIN_PROPERTY_SCHEMAS: Partial<Record<SceneObjectType, PropertySchema>> = {
  video: mediaSchema,
  image: mediaSchema,
}

export function getBuiltinPropertySchema(
  type: SceneObjectType | undefined,
): PropertySchema | undefined {
  if (!type) return undefined
  return BUILTIN_PROPERTY_SCHEMAS[type]
}
