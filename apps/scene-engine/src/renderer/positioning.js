function resolveAxis(value, dim) {
  if (value === 'center') return dim / 2;
  if (typeof value === 'string' && value.endsWith('%')) return dim * parseFloat(value) / 100;
  if (typeof value === 'number') return value;
  throw new Error(`Unsupported position value: ${value}`);
}

export function applyPosition(el, position, stage) {
  if (!position) return;
  el.style.position = 'absolute';
  el.style.left = resolveAxis(position.x, stage.width) + 'px';
  el.style.top = resolveAxis(position.y, stage.height) + 'px';
  el.style.transform = 'translate(-50%, -50%)';
}

export function applyScale(el, scale) {
  if (scale == null) return;
  el.style.scale = String(scale);
}
