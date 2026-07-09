import { resolveRuntimeUrl } from './runtime-url.js'

async function fetchManifest(sceneId, signal) {
  const url = resolveRuntimeUrl(`/scenes/${sceneId}/assets.json`)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Failed to fetch scene manifest for '${sceneId}': ${res.status}`)
  return res.json()
}

async function fetchWithProgress(filePath, onBytes, signal) {
  const url = resolveRuntimeUrl(`/${filePath}`)
  const res = await fetch(url, { signal })
  if (!res.ok) {
    console.warn(`[scene-preloader] failed to fetch ${filePath}: ${res.status}`)
    return
  }

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) onBytes(value.byteLength)
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    const buf = await res.arrayBuffer()
    onBytes(buf.byteLength)
  }
}

export async function preloadScene(sceneId, { onProgress, signal } = {}) {
  const manifest = await fetchManifest(sceneId, signal)
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) return

  const total = manifest.files.reduce((sum, f) => sum + (f.bytes || 0), 0)
  let loaded = 0

  const report = () => {
    if (onProgress) {
      const fraction = total > 0 ? Math.min(loaded / total, 1) : 0
      onProgress({ loaded, total, fraction })
    }
  }

  report()

  const files = manifest.files.slice()
  let i = 0

  async function worker() {
    while (i < files.length) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
      const entry = files[i++]
      try {
        await fetchWithProgress(entry.path, (bytes) => {
          loaded += bytes
          report()
        }, signal)
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        console.warn(`[scene-preloader] error fetching ${entry.path}:`, err)
      }
    }
  }

  const concurrency = 4
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}
