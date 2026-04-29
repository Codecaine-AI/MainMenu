import { getRenderer } from './asset-renderers/index.js';
import { loadRegistry, resolveAsset } from './asset-registry.js';

export async function renderScene(scene, root) {
  await loadRegistry();
  root.innerHTML = '';
  root.style.width = scene.stage.width + 'px';
  root.style.height = scene.stage.height + 'px';
  for (const layer of scene.layers) {
    const entry = resolveAsset(layer.asset);
    if (!entry) {
      console.warn(`[scene-renderer] Skipping layer ${layer.id}: unknown asset ${layer.asset}`);
      continue;
    }
    const el = await getRenderer(layer.type)(layer, entry);
    el.dataset.layerId = layer.id;
    el.style.position = 'absolute';
    if (!layer.position) el.style.inset = '0';
    root.appendChild(el);
  }
}
