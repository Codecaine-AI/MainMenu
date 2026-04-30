export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity',
] as const

export const FIT_OPTIONS = ['cover', 'contain', 'fill', 'none'] as const

export const ANCHOR_OPTIONS = [
  'top-left', 'top', 'top-right',
  'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right',
] as const

export const CLIP_OPTIONS = [
  { value: '', label: 'none' },
  { value: 'fill-clip', label: 'fill-clip (letter shapes)' },
] as const

export const NUMERIC_PROPERTY_STEPS: Record<string, { step: number; min: number; max: number }> = {
  opacity: { step: 0.01, min: 0, max: 1 },
  scale: { step: 0.05, min: 0.1, max: 5 },
  hue: { step: 1, min: -180, max: 180 },
  position_x: { step: 1, min: -100, max: 100 },
  position_y: { step: 1, min: -100, max: 100 },
  rotation: { step: 1, min: -180, max: 180 },
  speed: { step: 0.05, min: 0.05, max: 4 },
  repeat_x: { step: 1, min: 1, max: 8 },
  repeat_y: { step: 1, min: 1, max: 8 },
  x: { step: 0.5, min: -100, max: 200 },
  y: { step: 0.5, min: -100, max: 200 },
  width: { step: 0.5, min: 0, max: 200 },
  height: { step: 0.5, min: 0, max: 200 },
}

export const EVENT_TRIGGERS = ['click', 'hover', 'load'] as const
export const EVENT_ACTIONS = ['navigate', 'play-audio', 'autoplay'] as const
