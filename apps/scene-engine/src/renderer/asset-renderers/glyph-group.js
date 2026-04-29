import { applyPosition, applyScale } from '../positioning.js';
import { resolveAsset } from '../asset-registry.js';

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

  const xhtmlWrap = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  xhtmlWrap.setAttribute('style', 'width:100%;height:100%;position:relative');
  xhtmlWrap.appendChild(el);
  fo.appendChild(xhtmlWrap);

  if (anchor) svg.insertBefore(fo, anchor.nextSibling);
  else svg.insertBefore(fo, svg.firstChild);
  return fo;
}

export async function renderGlyphGroup(layer, entry) {
  const res = await fetch(entry.path);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svg = doc.documentElement;
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

  applyPosition(wrapper, layer.position, { width: 1440, height: 1080 });
  applyScale(wrapper, layer.properties?.scale);
  wrapper.style.transformOrigin = 'center center';

  return wrapper;
}
