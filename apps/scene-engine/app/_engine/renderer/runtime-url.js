export function bundleRootUrl() {
  return globalThis.MELEE_BUNDLE_ROOT || null;
}

export function projectRuntimeRootUrl() {
  const projectId = globalThis.MELEE_PROJECT_ID;
  if (typeof projectId !== 'string' || projectId.trim() === '') return null;
  return `/api/projects/${encodeURIComponent(projectId.trim())}`;
}

export function resolveRuntimeUrl(path) {
  if (typeof path !== 'string' || path.length === 0) return path;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  const root = bundleRootUrl();
  if (!root) {
    const projectRoot = projectRuntimeRootUrl();
    if (projectRoot && /^\/(?:assets|modules|fonts)\//.test(path)) return `${projectRoot}${path}`;
    return path;
  }

  if (path.startsWith('./')) {
    return new URL(path.slice(2), root).href;
  }
  if (path.startsWith('/')) {
    return new URL(path.replace(/^\/+/, ''), root).href;
  }
  return path;
}
