import type { PropertySchema } from '@/types/property-schema'

const moduleCache = new Map<string, Promise<PropertySchema | null>>()

function isPropertySchemaShape(value: unknown): value is PropertySchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { sections?: unknown }).sections)
  )
}

export function loadComponentSchema(modulePath: string): Promise<PropertySchema | null> {
  const cached = moduleCache.get(modulePath)
  if (cached) return cached

  const promise = (async (): Promise<PropertySchema | null> => {
    try {
      const res = await fetch(modulePath)
      if (!res.ok) throw new Error(`Failed to fetch ${modulePath}: ${res.status}`)
      const code = await res.text()
      const blob = new Blob([code], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      const mod = await import(/* webpackIgnore: true */ url)
      if (isPropertySchemaShape(mod.properties)) return mod.properties
      return null
    } catch (err) {
      console.warn('[component-schema-loader] failed to load', modulePath, err)
      moduleCache.delete(modulePath)
      return null
    }
  })()

  moduleCache.set(modulePath, promise)
  return promise
}
