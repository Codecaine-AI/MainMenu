export function patchFromDottedKey(dottedKey: string, value: unknown): Record<string, unknown> {
  const keys = dottedKey.split('.')
  const root: Record<string, unknown> = {}
  let cursor: Record<string, unknown> = root
  for (let i = 0; i < keys.length - 1; i++) {
    cursor[keys[i]] = {}
    cursor = cursor[keys[i]] as Record<string, unknown>
  }
  cursor[keys[keys.length - 1]] = value
  return root
}
