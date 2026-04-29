const bus = new EventTarget();
const store = { scene: null, registry: null, selectedPath: null, dirty: false };

export function setScene(scene) {
  store.scene = scene;
  bus.dispatchEvent(new CustomEvent('scene-changed', { detail: scene }));
}

export function setRegistry(registry) {
  store.registry = registry;
  bus.dispatchEvent(new CustomEvent('registry-changed', { detail: registry }));
}

export function setSelectedPath(path) {
  store.selectedPath = path;
  bus.dispatchEvent(new CustomEvent('selection-changed', { detail: path }));
}

export function subscribe(eventName, fn) {
  bus.addEventListener(eventName, fn);
  return () => bus.removeEventListener(eventName, fn);
}

export function getState() {
  return store;
}

function setDirty(value) {
  if (store.dirty === value) return;
  store.dirty = value;
  bus.dispatchEvent(new CustomEvent('dirty-changed', { detail: value }));
}

export function markDirty() {
  setDirty(true);
}

export function markClean() {
  setDirty(false);
}

export function getDirty() {
  return store.dirty;
}

function parsePath(path) {
  return path.split('.children.').map(n => Number(n));
}

function navigateToParentContainer(scene, path, { create = false } = {}) {
  const parts = parsePath(path);
  if (parts.length === 1) {
    return { container: scene.layers, index: parts[0] };
  }
  let layer = scene.layers[parts[0]];
  if (!layer) return { container: null, index: -1 };
  for (let i = 1; i < parts.length - 1; i++) {
    if (!layer.children) {
      if (!create) return { container: null, index: -1 };
      layer.children = [];
    }
    layer = layer.children[parts[i]];
    if (!layer) return { container: null, index: -1 };
  }
  if (!layer.children) {
    if (!create) return { container: null, index: -1 };
    layer.children = [];
  }
  return { container: layer.children, index: parts[parts.length - 1] };
}

function navigateToContainer(scene, parentPath, { create = false } = {}) {
  if (parentPath === '' || parentPath == null) return scene.layers;
  const parts = parsePath(parentPath);
  let layer = scene.layers[parts[0]];
  if (!layer) return null;
  for (let i = 1; i < parts.length; i++) {
    if (!layer.children) {
      if (!create) return null;
      layer.children = [];
    }
    layer = layer.children[parts[i]];
    if (!layer) return null;
  }
  if (!layer.children) {
    if (!create) return null;
    layer.children = [];
  }
  return layer.children;
}

function deepMerge(target, patch) {
  if (target == null || typeof target !== 'object' || Array.isArray(target)) return patch;
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function mutateLayerAt(path, patch) {
  if (!store.scene) return;
  const next = structuredClone(store.scene);
  const { container, index } = navigateToParentContainer(next, path);
  if (!container || container[index] == null) return;
  container[index] = deepMerge(container[index], patch);
  setScene(next);
  markDirty();
}

export function addLayerAt(parentPath, index, layer) {
  if (!store.scene) return;
  const next = structuredClone(store.scene);
  const container = navigateToContainer(next, parentPath, { create: true });
  if (!container) return;
  const insertAt = Math.max(0, Math.min(index, container.length));
  container.splice(insertAt, 0, layer);
  setScene(next);
  markDirty();
}

export function removeLayerAt(path) {
  if (!store.scene) return null;
  const next = structuredClone(store.scene);
  const { container, index } = navigateToParentContainer(next, path);
  if (!container || container[index] == null) return null;
  const [removed] = container.splice(index, 1);
  setScene(next);
  markDirty();
  return removed;
}

export function moveLayer(fromPath, toPath) {
  if (!store.scene || !fromPath || !toPath) return;
  if (fromPath === toPath) return;
  if (toPath.startsWith(fromPath + '.children.')) return;
  const next = structuredClone(store.scene);
  const fromInfo = navigateToParentContainer(next, fromPath);
  if (!fromInfo.container || fromInfo.container[fromInfo.index] == null) return;
  const toInfo = navigateToParentContainer(next, toPath, { create: true });
  if (!toInfo.container) return;
  const [layer] = fromInfo.container.splice(fromInfo.index, 1);
  let toIndex = toInfo.index;
  if (fromInfo.container === toInfo.container && fromInfo.index < toInfo.index) {
    toIndex -= 1;
  }
  toIndex = Math.max(0, Math.min(toIndex, toInfo.container.length));
  toInfo.container.splice(toIndex, 0, layer);
  setScene(next);
  markDirty();
}
