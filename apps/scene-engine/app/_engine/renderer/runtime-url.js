export function bundleRootUrl() {
  return globalThis.MELEE_BUNDLE_ROOT || null;
}

export function resolveRuntimeUrl(path) {
  if (typeof path !== 'string' || path.length === 0) return path;
  if (/^(?:[a-z]+:)?\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  const root = bundleRootUrl();
  if (!root) return path;

  if (path.startsWith('./')) {
    return new URL(path.slice(2), root).href;
  }
  if (path.startsWith('/')) {
    return new URL(path.replace(/^\/+/, ''), root).href;
  }
  return path;
}
