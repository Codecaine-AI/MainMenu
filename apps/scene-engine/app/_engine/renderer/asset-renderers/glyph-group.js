import { resolveAsset } from '../asset-registry.js';
import { syncMediaSurface } from '../media-surface.js';
import { resolveRuntimeUrl } from '../runtime-url.js';

const svgTextCache = new Map();
function fetchSvgText(path) {
  const url = resolveRuntimeUrl(path);
  if (!svgTextCache.has(url)) {
    svgTextCache.set(url, fetch(url).then(r => r.text()));
  }
  return svgTextCache.get(url);
}

function parseViewBox(svg) {
  const vbAttr = svg.getAttribute('viewBox');
  if (vbAttr) {
    const parts = vbAttr.split(/\s+/).map(Number);
    return { w: parts[2], h: parts[3] };
  }
  return {
    w: parseFloat(svg.getAttribute('width') || '0'),
    h: parseFloat(svg.getAttribute('height') || '0'),
  };
}

async function mountSlot(svg, slot, vb, anchorEl) {
  const entry = resolveAsset(slot.asset);
  if (!entry) {
    console.warn(`[glyph-group] Slot '${slot.id}' has unknown asset '${slot.asset}'`);
    return null;
  }
  const { getRenderer } = await import('./index.js');
  const leafType = slot.type === 'video-fill' ? 'video' : slot.type;
  const rendererFn = getRenderer(leafType);
  const el = slot.type === 'video-fill'
    ? document.createElement('div')
    : await rendererFn(slot, entry);
  if (slot.type === 'video-fill') {
    el.dataset.layerId = slot.id;
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.position = 'relative';
    el.style.overflow = 'hidden';
    syncMediaSurface(el, {
      type: 'video',
      entry,
      appearance: slot.appearance,
      properties: slot.properties,
    });
  }

  const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', String(vb.w));
  fo.setAttribute('height', String(vb.h));

  const clipPath = anchorEl.getAttribute('clip-path');
  if (clipPath) fo.setAttribute('clip-path', clipPath);

  const appearance = slot.appearance || {};
  if (slot.type !== 'video-fill' && typeof appearance.opacity === 'number') fo.style.opacity = String(appearance.opacity);
  if (typeof appearance.blend === 'string') fo.style.mixBlendMode = appearance.blend;
  if (slot.type !== 'video-fill' && typeof appearance.hue === 'number' && appearance.hue !== 0) {
    const existing = (el.style.filter || '').trim();
    el.style.filter = existing
      ? `${existing} hue-rotate(${appearance.hue}deg)`
      : `hue-rotate(${appearance.hue}deg)`;
  }
  if (slot.type !== 'video-fill' && typeof appearance.fit === 'string') {
    const mediaEl = el.querySelector?.('video, img') ?? el;
    mediaEl.style.objectFit = appearance.fit;
  }

  const xhtmlWrap = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  xhtmlWrap.setAttribute('style', 'width:100%;height:100%;position:relative;overflow:hidden;');
  xhtmlWrap.appendChild(el);
  fo.appendChild(xhtmlWrap);

  svg.insertBefore(fo, anchorEl.nextSibling);
  return fo;
}

export async function renderGlyphGroup(layer, entry) {
  const text = await fetchSvgText(entry.file);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;

  const bgRect = svg.querySelector('rect#background');
  if (bgRect) bgRect.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'glyph-group-layer';
  wrapper.dataset.layerId = layer.id;

  const vb = parseViewBox(svg);
  wrapper.style.width = vb.w + 'px';
  wrapper.style.height = vb.h + 'px';

  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';
  wrapper.appendChild(svg);

  for (const slot of (layer.slots ?? [])) {
    const anchor = svg.querySelector(`[data-slot="${slot.id}"]`);
    if (!anchor) {
      console.warn(`[glyph-group] No SVG slot for '${slot.id}'`);
      continue;
    }
    await mountSlot(svg, slot, vb, anchor);
  }

  return wrapper;
}
