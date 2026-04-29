const bus = new EventTarget();
const store = { scene: null, registry: null, selectedPath: null };

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
