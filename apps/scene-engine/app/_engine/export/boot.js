import { renderScene } from './renderer/scene-renderer.js'
import { loadRegistry } from './renderer/asset-registry.js'

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

function pageUrlForScene(sceneId) {
  return new URL(`${sceneId}/index.html`, BUNDLE_ROOT).href
}

async function boot() {
  const project = await fetchJson('./project.json')
  const stage = document.getElementById('stage')
  if (!stage) throw new Error('No #stage element')

  await loadRegistry()

  async function showScene(sceneId) {
    const scene = await fetchJson(`./scenes/${sceneId}/scene.json`)
    document.title = scene.name ?? project.name ?? 'Scene'
    await renderScene(scene, stage)
  }

  async function navigate(sceneId) {
    if (!sceneExists(project, sceneId)) {
      console.warn(`[boot] unknown scene '${sceneId}'`)
      return
    }
    if (window.MELEE_NAVIGATION_MODE === 'pages') {
      const nextUrl = pageUrlForScene(sceneId)
      if (window.location.href !== nextUrl) window.location.href = nextUrl
      return
    }
    await showScene(sceneId)
  }

  window.MELEE_navigate = (sceneId) => navigate(sceneId).catch(console.error)

  fitStage()
  window.addEventListener('resize', fitStage)

  await showScene(window.MELEE_INITIAL_SCENE ?? project.entry)
}

boot().catch((err) => console.error('[boot] failed:', err))
