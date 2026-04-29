import { loadRegistry, getRegistry } from '../../src/renderer/asset-registry.js';
import { setScene, setRegistry } from './state.js';

export async function loadEditorScene() {
  const sceneId = new URLSearchParams(location.search).get('scene') ?? 'title';
  await loadRegistry();
  setRegistry(getRegistry());
  const res = await fetch(`/scenes/${sceneId}/scene.json`);
  if (!res.ok) throw new Error(`[editor] failed to load scene '${sceneId}': ${res.status}`);
  const scene = await res.json();
  setScene(scene);
  return scene;
}
