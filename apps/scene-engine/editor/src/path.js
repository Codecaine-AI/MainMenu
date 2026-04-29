export function resolveLayer(scene, path) {
  if (!scene || !path) return null;
  const parts = path.split('.children.');
  let layer = scene.layers?.[Number(parts[0])];
  for (let i = 1; i < parts.length; i++) {
    if (!layer?.children) return null;
    layer = layer.children[Number(parts[i])];
    if (!layer) return null;
  }
  return layer ?? null;
}

export function resolveLayerEl(scene, path, stage) {
  if (!scene || !path || !stage) return null;
  const parts = path.split('.children.');
  const topLayer = scene.layers?.[Number(parts[0])];
  if (!topLayer) return null;
  const topEl = stage.querySelector(`[data-layer-id="${topLayer.id}"]`);
  if (!topEl || parts.length === 1) return topEl ?? null;
  let layer = topLayer;
  for (let i = 1; i < parts.length; i++) {
    const child = layer.children?.[Number(parts[i])];
    if (!child) return null;
    if (child.layer) {
      const svg = topEl.querySelector('svg');
      return svg?.querySelector(`[data-layer="${child.layer}"]`) ?? null;
    }
    if (child.type) {
      return null;
    }
    layer = child;
  }
  return null;
}
