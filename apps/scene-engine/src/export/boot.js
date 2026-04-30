import { renderScene } from './renderer/scene-renderer.js'
import { loadRegistry } from './renderer/asset-registry.js'

const STAGE_WIDTH = 1440
const STAGE_HEIGHT = 1080

function fitStage() {
  const stage = document.getElementById('stage')
  if (!stage) return
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
  stage.style.transform = `scale(${scale})`
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
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

  window.MELEE_navigate = (sceneId) => showScene(sceneId).catch(console.error)

  fitStage()
  window.addEventListener('resize', fitStage)

  await showScene(project.entry)
}

boot().catch((err) => console.error('[boot] failed:', err))
