import { loadRegistry, getRegistry } from '../../src/renderer/asset-registry.js';
import { setScene, setRegistry, markClean } from './state.js';

export function getEditorSceneId() {
  return new URLSearchParams(location.search).get('scene') ?? 'title';
}

export async function loadEditorScene() {
  const sceneId = getEditorSceneId();
  await loadRegistry();
  setRegistry(getRegistry());
  const res = await fetch(`/scenes/${sceneId}/scene.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[editor] failed to load scene '${sceneId}': ${res.status}`);
  const scene = await res.json();
  setScene(scene);
  markClean();
  return scene;
}
