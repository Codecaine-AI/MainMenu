import { getRenderer } from './asset-renderers/index.js';

export function renderScene(scene, root) {
  root.innerHTML = '';
  root.style.width = scene.stage.width + 'px';
  root.style.height = scene.stage.height + 'px';
  for (const layer of scene.layers) {
    const el = getRenderer(layer.type)(layer);
    el.style.position = 'absolute';
    el.style.inset = '0';
    root.appendChild(el);
  }
}
