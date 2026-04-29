import { applyPosition, applyScale } from '../positioning.js';

export async function renderGlyphGroup(layer, entry) {
  const res = await fetch(entry.path);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  const wrapper = document.createElement('div');
  wrapper.className = 'glyph-group-layer';
  wrapper.dataset.layerId = layer.id;

  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(/\s+/).map(Number);
    wrapper.style.width = parts[2] + 'px';
    wrapper.style.height = parts[3] + 'px';
  } else {
    wrapper.style.width = (svg.getAttribute('width') || '0') + 'px';
    wrapper.style.height = (svg.getAttribute('height') || '0') + 'px';
  }

  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';
  wrapper.appendChild(svg);

  applyPosition(wrapper, layer.position, { width: 1440, height: 1080 });
  applyScale(wrapper, layer.properties?.scale);
  wrapper.style.transformOrigin = 'center center';

  return wrapper;
}
