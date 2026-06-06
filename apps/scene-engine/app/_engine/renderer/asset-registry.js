import { projectRuntimeRootUrl, resolveRuntimeUrl } from './runtime-url.js';

let mergedRegistry = null;
let activeRegistryKey = null;
const registryCache = new Map();
const loadPromises = new Map();

async function fetchManifest(url) {
  try {
    const res = await fetch(resolveRuntimeUrl(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[asset-registry] failed to load ${url}`, err);
    return {};
  }
}

async function fetchOptionalManifest(url) {
  try {
    const res = await fetch(resolveRuntimeUrl(url));
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

function deriveManifestUrl(entryPath) {
  if (typeof entryPath !== 'string') return null;
  const lastSlash = entryPath.lastIndexOf('/');
  if (lastSlash < 0) return null;
  return `${entryPath.slice(0, lastSlash + 1)}manifest.json`;
}

async function fetchModuleManifest(url) {
  try {
    const res = await fetch(resolveRuntimeUrl(url));
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[asset-registry] manifest fetch failed ${res.status}: ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[asset-registry] manifest fetch error: ${url}`, err);
    return null;
  }
}

function projectIdFromOptions(options = {}) {
  if (typeof options.projectId === 'string' && options.projectId.trim()) return options.projectId.trim();
  if (typeof globalThis.MELEE_PROJECT_ID === 'string' && globalThis.MELEE_PROJECT_ID.trim()) {
    return globalThis.MELEE_PROJECT_ID.trim();
  }
  return null;
}

function registryUrls(options = {}) {
  if (globalThis.MELEE_BUNDLE_ROOT) {
    return {
      key: 'bundle',
      assets: '/assets/registry.json',
      modules: '/modules/registry.json',
      fonts: ['/fonts/registry.json'],
    };
  }
  const projectId = projectIdFromOptions(options);
  const projectRoot = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : projectRuntimeRootUrl();
  if (!projectRoot) throw new Error('[asset-registry] project id is required outside export bundles');
  return {
    key: `project:${projectId ?? projectRoot}`,
    assets: `${projectRoot}/registries/assets`,
    modules: `${projectRoot}/registries/modules`,
    fonts: [`${projectRoot}/registries/fonts`],
  };
}

export async function loadRegistry(options = {}) {
  const urls = registryUrls(options);
  if (registryCache.has(urls.key)) {
    activeRegistryKey = urls.key;
    mergedRegistry = registryCache.get(urls.key);
    return mergedRegistry;
  }
  if (loadPromises.has(urls.key)) return loadPromises.get(urls.key);
  const loadPromise = (async () => {
    const [assets, modules, ...fontRegistries] = await Promise.all([
      fetchManifest(urls.assets),
      fetchManifest(urls.modules),
      ...urls.fonts.map((url) => fetchOptionalManifest(url)),
    ]);
    const merged = { ...Object.assign({}, ...fontRegistries), ...assets };
    for (const [id, entry] of Object.entries(modules)) {
      if (id in merged) {
        console.warn(`[asset-registry] id collision: ${id} — module overrides asset`);
      }
      merged[id] = entry;
    }
    const entriesNeedingManifest = Object.entries(merged).filter(
      ([, e]) => e && typeof e.path === 'string',
    );
    await Promise.all(
      entriesNeedingManifest.map(async ([, entry]) => {
        const url = deriveManifestUrl(entry.path);
        if (!url) return;
        const manifest = await fetchModuleManifest(url);
        if (manifest) entry.manifest = manifest;
      }),
    );
    registryCache.set(urls.key, merged);
    activeRegistryKey = urls.key;
    mergedRegistry = merged;
    return mergedRegistry;
  })();
  loadPromises.set(urls.key, loadPromise);
  loadPromise.finally(() => loadPromises.delete(urls.key));
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
  if (activeRegistryKey && registryCache.has(activeRegistryKey)) return registryCache.get(activeRegistryKey);
  return mergedRegistry;
}

export function updateEntry(id, partial) {
  if (!mergedRegistry || !mergedRegistry[id]) return null;
  mergedRegistry[id] = { ...mergedRegistry[id], ...partial };
  return mergedRegistry[id];
}
