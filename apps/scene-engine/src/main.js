import './styles/stage.css';
import { renderScene } from './renderer/scene-renderer.js';
import './renderer/asset-renderers/index.js';

async function boot() {
  const sceneId = window.__SCENE_ID__ ?? 'title';
  const res = await fetch(`/scenes/${sceneId}/scene.json`);
  const scene = await res.json();
  await renderScene(scene, document.getElementById('stage'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
