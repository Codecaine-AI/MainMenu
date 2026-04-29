const cache = new Map();
let currentUrl = null;

export async function loadRegistry(url = '/assets/registry.json') {
  if (cache.has(url)) {
    currentUrl = url;
    return cache.get(url);
  }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = await res.json();
    cache.set(url, parsed);
    currentUrl = url;
    return parsed;
  } catch (err) {
    console.error(`[asset-registry] failed to load ${url}`, err);
    cache.set(url, {});
    currentUrl = url;
    return {};
  }
}

export function resolveAsset(id) {
  if (!currentUrl) {
    console.warn('[asset-registry] resolveAsset called before loadRegistry');
    return null;
  }
  const entry = cache.get(currentUrl)?.[id];
  if (!entry) {
    console.warn(`[asset-registry] Unknown asset id: ${id}`);
    return null;
  }
  return entry;
}

export function getRegistry() {
  return cache.get(currentUrl) || null;
}
