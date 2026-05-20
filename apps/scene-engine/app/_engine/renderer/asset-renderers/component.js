import { ensureStylesheet } from './stylesheet.js';
import { resolveRuntimeUrl } from '../runtime-url.js';

const moduleCache = new Map();

function deriveCssPath(jsPath) {
  if (typeof jsPath !== 'string' || !jsPath.endsWith('.js')) return null;
  return jsPath.slice(0, -3) + '.css';
}

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

export async function renderComponent(layer, entry, options = {}) {
  const cssPath = deriveCssPath(entry.path);
  if (cssPath) ensureStylesheet(cssPath);
  const mod = await loadModule(entry.path);
  if (typeof mod?.default !== 'function') {
    console.error(`[component] asset ${entry.path} has no default export function`);
    const placeholder = document.createElement('div');
    placeholder.dataset.layerId = layer.id;
    return placeholder;
  }
  const el = await mod.default({
    properties: layer.properties || {},
    layerId: layer.id,
    runtime: options.runtime,
  });
  return el;
}
