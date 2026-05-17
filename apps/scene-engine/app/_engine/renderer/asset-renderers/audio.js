import { resolveRuntimeUrl } from '../runtime-url.js';

const moduleCache = new Map();

function loadModule(path) {
  const url = resolveRuntimeUrl(path);
  if (moduleCache.has(url)) return moduleCache.get(url);
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
      return res.text();
    })
    .then((code) => {
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      return import(/* webpackIgnore: true */ url);
    })
    .catch((err) => {
      moduleCache.delete(url);
      throw err;
    });
  moduleCache.set(url, promise);
  return promise;
}

export async function renderAudio(layer, entry) {
  const mod = await loadModule(entry.file);
  if (typeof mod?.default !== 'function') {
    console.error(`[audio] asset ${entry.file} has no default export function`);
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    placeholder.dataset.layerId = layer.id;
    return placeholder;
  }
  const el = await mod.default({ properties: layer.properties || {}, layerId: layer.id });
  if (el && el.style) el.style.display = 'none';
  return el;
}
