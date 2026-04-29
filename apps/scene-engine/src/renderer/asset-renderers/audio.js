const moduleCache = new Map();

function loadModule(path) {
  if (moduleCache.has(path)) return moduleCache.get(path);
  const promise = import(/* @vite-ignore */ path).catch((err) => {
    moduleCache.delete(path);
    throw err;
  });
  moduleCache.set(path, promise);
  return promise;
}

export async function renderAudio(layer, entry) {
  const mod = await loadModule(entry.path);
  if (typeof mod?.default !== 'function') {
    console.error(`[audio] asset ${entry.path} has no default export function`);
    const placeholder = document.createElement('div');
    placeholder.style.display = 'none';
    placeholder.dataset.layerId = layer.id;
    return placeholder;
  }
  const el = await mod.default({ properties: layer.properties || {}, layerId: layer.id });
  if (el && el.style) el.style.display = 'none';
  return el;
}
