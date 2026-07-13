import { renderScene } from './renderer/scene-renderer.js'
import { loadRegistry } from './renderer/asset-registry.js'
import { preloadScene } from './renderer/scene-preloader.js'

const STAGE_WIDTH = 1440
const STAGE_HEIGHT = 1080
const BUNDLE_ROOT = new URL('.', import.meta.url)

window.MELEE_BUNDLE_ROOT = BUNDLE_ROOT.href

function fitStage() {
  const stage = document.getElementById('stage')
  if (!stage) return
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
  stage.style.transform = `scale(${scale})`
}

async function fetchJson(url) {
  const res = await fetch(new URL(url, BUNDLE_ROOT))
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

function sceneExists(project, sceneId) {
  return Array.isArray(project.scenes) && project.scenes.some((scene) => scene.id === sceneId)
}

function spaPathForScene(sceneId, entryId) {
  return sceneId === entryId ? '/' : '/' + sceneId
}

function sceneIdFromPathname(pathname, entryId) {
  // Strip leading/trailing slashes and trailing index.html
  const clean = pathname.replace(/^\/+|\/+$/g, '').replace(/\/index\.html$/, '').replace(/^index\.html$/, '')
  if (!clean) return entryId
  // Take first path segment as scene id
  return clean.split('/')[0]
}

async function boot() {
  const project = await fetchJson('./project.json')
  const stage = document.getElementById('stage')
  if (!stage) throw new Error('No #stage element')

  await loadRegistry()

  async function showScene(sceneId) {
    const scene = await fetchJson(`./scenes/${sceneId}/scene.json`)
    document.title = project.web?.title ?? scene.name ?? project.name ?? 'Scene'
    stage.innerHTML = ''
    await renderScene(scene, stage, { postProcessing: project.postProcessing })
  }

  // Determine navigation mode:
  // - 'pages' only if explicitly set OR running on file:// (history API doesn't work there)
  const isFileProtocol = typeof location !== 'undefined' && location.protocol === 'file:'
  const usePagesMode = window.MELEE_NAVIGATION_MODE === 'pages' || isFileProtocol

  // Popstate listener for browser back/forward in SPA mode
  if (!usePagesMode) {
    window.addEventListener('popstate', (event) => {
      const sceneId = event.state?.sceneId || sceneIdFromPathname(location.pathname, project.entry)
      showScene(sceneId).catch(console.error)
    })
  }

  function findSceneRef(sceneId) {
    return project.scenes.find((s) => s.id === sceneId)
  }

  function findGateSceneFor(targetId) {
    return project.scenes.find((s) => s.gates === targetId)
  }

  function findLoadingElement() {
    return stage.querySelector('[data-layer-id="loading-dialog"]')
        ?? stage.querySelector('.loading-dialog')
  }

  function waitForPaint() {
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }

  async function showWithGate(gateSceneId, targetSceneId) {
    await showScene(gateSceneId)
    await waitForPaint()

    const loadingEl = findLoadingElement()
    try {
      await preloadScene(targetSceneId, {
        onProgress({ fraction }) {
          if (loadingEl?.setProgress) loadingEl.setProgress(fraction)
        },
      })
    } catch (err) {
      console.warn('[boot] preload failed, transitioning anyway:', err)
    }

    stage.innerHTML = ''
    await showScene(targetSceneId)
  }

  async function navigate(sceneId) {
    if (!sceneExists(project, sceneId)) {
      console.warn(`[boot] unknown scene '${sceneId}'`)
      return
    }
    if (usePagesMode) {
      const nextUrl = new URL(`${sceneId}/index.html`, BUNDLE_ROOT).href
      if (window.location.href !== nextUrl) window.location.href = nextUrl
      return
    }

    const gateScene = findGateSceneFor(sceneId)
    if (gateScene) {
      const targetPath = spaPathForScene(sceneId, project.entry)
      const currentPath = location.pathname
      await showWithGate(gateScene.id, sceneId)
      if (currentPath !== targetPath) {
        history.pushState({ sceneId }, '', targetPath)
      }
    } else {
      const targetPath = spaPathForScene(sceneId, project.entry)
      const currentPath = location.pathname
      await showScene(sceneId)
      if (currentPath !== targetPath) {
        history.pushState({ sceneId }, '', targetPath)
      }
    }
  }

  window.MELEE_navigate = (sceneId) => navigate(sceneId).catch(console.error)

  fitStage()
  window.addEventListener('resize', fitStage)

  const initialScene = window.MELEE_INITIAL_SCENE ?? project.entry
  const entryRef = findSceneRef(initialScene)

  if (entryRef?.gates && sceneExists(project, entryRef.gates)) {
    await showWithGate(initialScene, entryRef.gates)
  } else {
    const gateScene = findGateSceneFor(initialScene)
    if (gateScene) {
      await showWithGate(gateScene.id, initialScene)
    } else {
      await showScene(initialScene)
    }
  }

  schedulePrefetch()
}

boot().catch((err) => console.error('[boot] failed:', err))

// ---------------------------------------------------------------------------
// Idle prefetcher — warms the HTTP cache while the first scene is on screen
// ---------------------------------------------------------------------------

let prefetchStarted = false

async function runPrefetch() {
  if (navigator.connection?.saveData === true) return
  if (location.protocol === 'file:') return

  let manifest
  try {
    const res = await fetch(new URL('prefetch-manifest.json', BUNDLE_ROOT), { priority: 'low' })
    if (!res.ok) return
    manifest = await res.json()
  } catch {
    return
  }

  if (!Array.isArray(manifest?.files)) return

  // Tiered ordering: scene data and code, then audio, fonts, images, video —
  // sounds and navigation logic are ready long before the big media finishes.
  const tierOf = (p) => {
    if (/\.(json|js|mjs|css)$/i.test(p)) return 0
    if (/\.(mp3|wav|ogg|m4a)$/i.test(p)) return 1
    if (/\.(woff2?|otf|ttf)$/i.test(p)) return 2
    if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(p)) return 3
    if (/\.(mp4|webm)$/i.test(p)) return 4
    return 5
  }
  const files = [...manifest.files].sort(
    (a, b) => tierOf(a.path) - tierOf(b.path) || (a.bytes ?? 0) - (b.bytes ?? 0),
  )

  // Fetch with a concurrency pool of 2
  const pool = 2
  let idx = 0
  async function worker() {
    while (idx < files.length) {
      const file = files[idx++]
      try {
        const res = await fetch(new URL(file.path, BUNDLE_ROOT), { priority: 'low' })
        if (res.ok) await res.arrayBuffer()
      } catch {
        // ignore individual failures
      }
    }
  }
  await Promise.all(Array.from({ length: pool }, worker))
}

function schedulePrefetch() {
  if (prefetchStarted) return
  prefetchStarted = true
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => runPrefetch().catch(() => {}))
    } else {
      runPrefetch().catch(() => {})
    }
  }, 1500)
}
