let mergedRegistry = null;
let loadPromise = null;

async function fetchManifest(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[asset-registry] failed to load ${url}`, err);
    return {};
  }
}

export async function loadRegistry() {
  if (mergedRegistry) return mergedRegistry;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [assets, modules] = await Promise.all([
      fetchManifest('/assets/registry.json'),
      fetchManifest('/modules/registry.json'),
    ]);
    const merged = { ...assets };
    for (const [id, entry] of Object.entries(modules)) {
      if (id in merged) {
        console.warn(`[asset-registry] id collision: ${id} — module overrides asset`);
      }
      merged[id] = entry;
    }
    mergedRegistry = merged;
    return mergedRegistry;
  })();
  return loadPromise;
}

export function resolveAsset(id) {
  if (!mergedRegistry) {
    console.warn('[asset-registry] resolveAsset called before loadRegistry');
    return null;
  }
  const entry = mergedRegistry[id];
  if (!entry) {
    console.warn(`[asset-registry] Unknown asset id: ${id}`);
    return null;
  }
  return entry;
}

export function getRegistry() {
  return mergedRegistry;
}

export function updateEntry(id, partial) {
  if (!mergedRegistry || !mergedRegistry[id]) return null;
  mergedRegistry[id] = { ...mergedRegistry[id], ...partial };
  return mergedRegistry[id];
}
