export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'untitled'
}

export function uniqueId(base: string, exists: (id: string) => boolean): string {
  const root = slugify(base)
  if (!exists(root)) return root

  let index = 2
  while (exists(`${root}-${index}`)) {
    index += 1
  }
  return `${root}-${index}`
}

export function assertSafeId(id: string, label = 'id'): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid ${label}: ${id}`)
  }
  return id
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function splitInstructionLabel(instruction: string): string {
  const cleaned = instruction.trim().replace(/\s+/g, ' ')
  if (cleaned.length <= 56) return cleaned
  return `${cleaned.slice(0, 53)}...`
}
