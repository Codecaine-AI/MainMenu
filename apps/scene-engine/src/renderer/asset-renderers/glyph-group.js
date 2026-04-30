import { resolveAsset } from '../asset-registry.js';

const svgTextCache = new Map();
function fetchSvgText(path) {
  if (!svgTextCache.has(path)) {
    svgTextCache.set(path, fetch(path).then(r => r.text()));
  }
  return svgTextCache.get(path);
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

function applySubLayerOverride(el, child) {
  if (child.visible === false) el.style.display = 'none';
  const props = child.properties || {};
  if (typeof props.hue === 'number') {
    const existing = (el.style.filter || '').trim();
    el.style.filter = existing
      ? `${existing} hue-rotate(${props.hue}deg)`
      : `hue-rotate(${props.hue}deg)`;
  }
  if (typeof props.blend === 'string') el.style.mixBlendMode = props.blend;
  if (typeof props.opacity === 'number') el.style.opacity = String(props.opacity);
}

async function mountForeignChild(svg, child, vb, anchor) {
  const entry = resolveAsset(child.asset);
  if (!entry) {
    console.warn(`[glyph-group] Foreign child '${child.id}' has unknown asset '${child.asset}'`);
    return null;
  }
  const { getRenderer } = await import('./index.js');
  const rendererFn = getRenderer(child.type);
  const el = await rendererFn(child, entry);

  const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo.setAttribute('x', '0');
  fo.setAttribute('y', '0');
  fo.setAttribute('width', String(vb.w));
  fo.setAttribute('height', String(vb.h));

  const props = child.properties || {};
  if (typeof props.opacity === 'number') fo.style.opacity = String(props.opacity);
  if (typeof props.blend === 'string') fo.style.mixBlendMode = props.blend;
  if (typeof props.clip === 'string') fo.setAttribute('clip-path', `url(#${props.clip})`);

  const xhtmlWrap = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  const posX = props.position_x ?? 0;
  const posY = props.position_y ?? 0;
  const scale = props.scale ?? 1;
  const rotation = props.rotation ?? 0;
  const transforms = [];
  if (posX !== 0 || posY !== 0) transforms.push(`translate(${posX}%, ${posY}%)`);
  if (scale !== 1) transforms.push(`scale(${scale})`);
  if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
  const transformStr = transforms.length ? `transform:${transforms.join(' ')};transform-origin:center center;` : '';
  xhtmlWrap.setAttribute('style', `width:100%;height:100%;position:relative;overflow:hidden;${transformStr}`);

  if (typeof props.hue === 'number' && props.hue !== 0) {
    el.style.filter = `hue-rotate(${props.hue}deg)`;
  }
  if (typeof props.speed === 'number' && props.speed !== 1 && el.tagName === 'VIDEO') {
    el.defaultPlaybackRate = props.speed;
    el.playbackRate = props.speed;
  }

  const repeatX = Math.max(1, Math.round(props.repeat_x ?? 1));
  const repeatY = Math.max(1, Math.round(props.repeat_y ?? 1));
  const totalTiles = repeatX * repeatY;

  if (totalTiles > 1) {
    xhtmlWrap.style.display = 'grid';
    xhtmlWrap.style.gridTemplateColumns = `repeat(${repeatX}, 1fr)`;
    xhtmlWrap.style.gridTemplateRows = `repeat(${repeatY}, 1fr)`;
    for (let i = 1; i < totalTiles; i++) {
      const clone = el.cloneNode(true);
      if (clone.tagName === 'VIDEO') {
        clone.autoplay = true;
        clone.muted = true;
        clone.loop = true;
        clone.play().catch(() => {});
      }
      xhtmlWrap.appendChild(clone);
    }
  }

  xhtmlWrap.appendChild(el);
  fo.appendChild(xhtmlWrap);

  if (anchor) svg.insertBefore(fo, anchor.nextSibling);
  else svg.insertBefore(fo, svg.firstChild);
  return fo;
}

function applyCssVars(svg, layer) {
  const scope = 'melee3';
  for (const child of (layer.children ?? [])) {
    if (!child.layer) continue;
    const props = child.properties ?? {};
    if (typeof props.opacity === 'number') {
      svg.style.setProperty(`--${scope}-${child.layer}-opacity`, String(props.opacity));
    }
    if (typeof props.paint === 'string') {
      svg.style.setProperty(`--${scope}-${child.layer}-paint`, props.paint);
    }
  }
}

export async function discoverGlyphLayers(path) {
  const text = await fetchSvgText(path);
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
  const layers = [];
  for (const el of svg.querySelectorAll('[data-layer]')) {
    layers.push(el.getAttribute('data-layer'));
  }
  return layers;
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

  applyCssVars(svg, layer);

  let lastNamedAnchor = null;
  for (const child of (layer.children ?? [])) {
    if (child.layer) {
      const matched = svg.querySelector(`[data-layer="${child.layer}"]`);
      if (!matched) {
        console.warn(`[glyph-group] Unknown sub-layer: ${child.layer}`);
        continue;
      }
      applySubLayerOverride(matched, child);
      lastNamedAnchor = matched;
    } else if (child.type) {
      const fo = await mountForeignChild(svg, child, vb, lastNamedAnchor);
      if (fo) lastNamedAnchor = fo;
    }
  }

  return wrapper;
}
