import { ensureStylesheet } from './stylesheet.js';

const moduleCache = new Map();

function deriveCssPath(jsPath) {
  if (typeof jsPath !== 'string' || !jsPath.endsWith('.js')) return null;
  return jsPath.slice(0, -3) + '.css';
}

function loadModule(path) {
  if (moduleCache.has(path)) return moduleCache.get(path);
  const promise = fetch(path)
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
      moduleCache.delete(path);
      throw err;
    });
  moduleCache.set(path, promise);
  return promise;
}

export async function renderComponent(layer, entry) {
  const cssPath = deriveCssPath(entry.path);
  if (cssPath) ensureStylesheet(cssPath);
  const mod = await loadModule(entry.path);
  if (typeof mod?.default !== 'function') {
    console.error(`[component] asset ${entry.path} has no default export function`);
    const placeholder = document.createElement('div');
    placeholder.dataset.layerId = layer.id;
    return placeholder;
  }
  const el = await mod.default({ properties: layer.properties || {}, layerId: layer.id });
  return el;
}
