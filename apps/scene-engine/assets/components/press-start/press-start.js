export default function ({ properties = {}, layerId } = {}) {
  const el = document.createElement('div');
  el.className = 'press-start';
  const NBSP = ' ';
  el.textContent = properties.text ?? `PRESS${NBSP}${NBSP}START`;
  el.style.setProperty('--blink-duration', `${properties['blink-rate'] ?? 1.1}s`);
  if (layerId) el.dataset.layerId = layerId;
  return el;
}
