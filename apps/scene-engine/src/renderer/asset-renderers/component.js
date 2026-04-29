import { ensureStylesheet } from './stylesheet.js';

const moduleCache = new Map();

function deriveCssPath(jsPath) {
  if (typeof jsPath !== 'string' || !jsPath.endsWith('.js')) return null;
  return jsPath.slice(0, -3) + '.css';
}

function loadModule(path) {
  if (moduleCache.has(path)) return moduleCache.get(path);
  const promise = import(/* @vite-ignore */ path).catch((err) => {
    moduleCache.delete(path);
    throw err;
  });
  moduleCache.set(path, promise);
  return promise;
}

function applyPosition(el, position) {
  if (!position) return;
  el.style.position = 'absolute';
  let tx = '';
  const x = position.x;
  const y = position.y;
  if (typeof x === 'number') {
    el.style.left = x + 'px';
  } else if (typeof x === 'string') {
    if (x === 'center') {
      el.style.left = '50%';
      tx += ' translateX(-50%)';
    } else {
      el.style.left = x;
    }
  }
  if (typeof y === 'number') {
    el.style.top = y + 'px';
  } else if (typeof y === 'string') {
    if (y === 'center') {
      el.style.top = '50%';
      tx += ' translateY(-50%)';
    } else {
      el.style.top = y;
    }
  }
  if (tx) el.style.transform = (el.style.transform || '') + tx;
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
  applyPosition(el, layer.position);
  return el;
}
