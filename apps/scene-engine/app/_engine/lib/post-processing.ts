import type { PostEffectBlend, PostProcessingSettings } from '@/types/scene'

export const DEFAULT_POST_PROCESSING: PostProcessingSettings = {
  enabled: true,
  grain: {
    enabled: false,
    animated: false,
    speed: 12,
    colored: false,
    opacity: 0.075,
    frequency: 0.8,
    contrast: 1.3,
    blend: 'screen',
  },
  vignette: {
    enabled: false,
    intensity: 0.35,
    size: 0.6,
    color: '#000000',
  },
}

const POST_EFFECT_BLENDS: PostEffectBlend[] = [
  'screen',
  'overlay',
  'soft-light',
  'multiply',
  'normal',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function blendOrDefault(value: unknown): PostEffectBlend {
  return typeof value === 'string' && POST_EFFECT_BLENDS.includes(value as PostEffectBlend)
    ? (value as PostEffectBlend)
    : DEFAULT_POST_PROCESSING.grain.blend
}

function colorOrDefault(value: unknown) {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : DEFAULT_POST_PROCESSING.vignette.color
}

export function normalizePostProcessing(input: unknown): PostProcessingSettings {
  const source = isRecord(input) ? input : {}
  const grain = isRecord(source.grain) ? source.grain : {}
  const vignette = isRecord(source.vignette) ? source.vignette : {}

  return {
    enabled: booleanOrDefault(source.enabled, DEFAULT_POST_PROCESSING.enabled),
    grain: {
      enabled: booleanOrDefault(grain.enabled, DEFAULT_POST_PROCESSING.grain.enabled),
      animated: booleanOrDefault(grain.animated, DEFAULT_POST_PROCESSING.grain.animated),
      speed: clampNumber(grain.speed, 1, 60, DEFAULT_POST_PROCESSING.grain.speed),
      colored: booleanOrDefault(grain.colored, DEFAULT_POST_PROCESSING.grain.colored),
      opacity: clampNumber(grain.opacity, 0, 1, DEFAULT_POST_PROCESSING.grain.opacity),
      frequency: clampNumber(grain.frequency, 0.25, 1.6, DEFAULT_POST_PROCESSING.grain.frequency),
      contrast: clampNumber(grain.contrast, 0.55, 2.2, DEFAULT_POST_PROCESSING.grain.contrast),
      blend: blendOrDefault(grain.blend),
    },
    vignette: {
      enabled: booleanOrDefault(vignette.enabled, DEFAULT_POST_PROCESSING.vignette.enabled),
      intensity: clampNumber(vignette.intensity, 0, 1, DEFAULT_POST_PROCESSING.vignette.intensity),
      size: clampNumber(vignette.size, 0, 1, DEFAULT_POST_PROCESSING.vignette.size),
      color: colorOrDefault(vignette.color),
    },
  }
}
