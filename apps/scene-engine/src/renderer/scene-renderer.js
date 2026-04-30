import { getRenderer } from './asset-renderers/index.js';
import { loadRegistry, resolveAsset } from './asset-registry.js';
import { applyPosition, applyScale } from './positioning.js';

function updateLayerStyles(el, layer, entry) {
  const props = layer.properties || {};

  if (layer.visible === false) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  el.style.position = 'absolute';
  if (!layer.position) el.style.inset = '0';

  if (layer.type === 'media' || layer.type === 'video' || layer.type === 'image') {
    el.style.objectFit = props.fit ?? 'cover';
    el.style.mixBlendMode = props.blend ?? 'normal';
    el.style.opacity = props.opacity ?? 1;
    if (el.src && entry.file && !el.src.endsWith(entry.file)) {
      el.src = entry.file;
    }
  }

  if (layer.type === 'glyph-group') {
    updateGlyphGroup(el, layer);
  }
}

function updateGlyphGroup(wrapper, layer) {
  const svg = wrapper.querySelector('svg');
  if (!svg) return;

  const scope = 'melee3';
  for (const child of (layer.children ?? [])) {
    if (child.layer) {
      const matched = svg.querySelector(`[data-layer="${child.layer}"]`);
      if (!matched) continue;
      matched.style.display = child.visible === false ? 'none' : '';
      const props = child.properties || {};
      if (typeof props.opacity === 'number') {
        matched.style.opacity = String(props.opacity);
        svg.style.setProperty(`--${scope}-${child.layer}-opacity`, String(props.opacity));
      }
      if (typeof props.blend === 'string') matched.style.mixBlendMode = props.blend;
      if (typeof props.hue === 'number') {
        matched.style.filter = props.hue !== 0 ? `hue-rotate(${props.hue}deg)` : '';
      }
    } else if (child.type) {
      const fo = svg.querySelector(`foreignObject [data-layer-id="${child.id}"]`)?.closest('foreignObject')
        ?? [...svg.querySelectorAll('foreignObject')].find(f => {
          const inner = f.querySelector('[data-layer-id]');
          return inner?.dataset.layerId === child.id;
        });
      if (fo) updateForeignChild(fo, child);
    }
  }

  wrapper.style.transform = '';
  applyPosition(wrapper, layer.position, { width: 1440, height: 1080 });
  applyScale(wrapper, layer.properties?.scale);
  wrapper.style.transformOrigin = 'center center';
}

function updateForeignChild(fo, child) {
  const props = child.properties || {};
  if (typeof props.opacity === 'number') fo.style.opacity = String(props.opacity);
  if (typeof props.blend === 'string') fo.style.mixBlendMode = props.blend;
  if (typeof props.clip === 'string') {
    fo.setAttribute('clip-path', `url(#${props.clip})`);
  }

  const xhtmlWrap = fo.querySelector('div');
  if (xhtmlWrap) {
    const posX = props.position_x ?? 0;
    const posY = props.position_y ?? 0;
    const scale = props.scale ?? 1;
    const rotation = props.rotation ?? 0;
    const transforms = [];
    if (posX !== 0 || posY !== 0) transforms.push(`translate(${posX}%, ${posY}%)`);
    if (scale !== 1) transforms.push(`scale(${scale})`);
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    xhtmlWrap.style.transform = transforms.length ? transforms.join(' ') : '';
    xhtmlWrap.style.transformOrigin = transforms.length ? 'center center' : '';
  }

  const mediaEl = fo.querySelector('video, img');
  if (mediaEl) {
    if (typeof props.hue === 'number') {
      mediaEl.style.filter = props.hue !== 0 ? `hue-rotate(${props.hue}deg)` : '';
    }
    if (typeof props.speed === 'number' && mediaEl.tagName === 'VIDEO') {
      if (mediaEl.playbackRate !== props.speed) {
        mediaEl.playbackRate = props.speed;
      }
    }
  }
}

export async function renderScene(scene, root) {
  await loadRegistry();

  const existing = new Map();
  for (const child of root.children) {
    const id = child.dataset?.layerId;
    if (id) existing.set(id, child);
  }

  if (existing.size > 0) {
    const wantedIds = new Set(scene.objects.map(l => l.id));

    for (const [id, el] of existing) {
      if (!wantedIds.has(id)) {
        el.remove();
        existing.delete(id);
      }
    }

    for (const layer of scene.objects) {
      const el = existing.get(layer.id);
      const entry = resolveAsset(layer.asset);
      if (!entry) continue;
      if (el) {
        updateLayerStyles(el, layer, entry);
      } else {
        const newEl = await getRenderer(layer.type)(layer, entry);
        newEl.dataset.layerId = layer.id;
        newEl.style.position = 'absolute';
        if (!layer.position) newEl.style.inset = '0';
        root.appendChild(newEl);
      }
    }

    reorderChildren(root, scene.objects);
    return;
  }

  root.innerHTML = '';
  root.style.width = scene.stage.width + 'px';
  root.style.height = scene.stage.height + 'px';
  for (const layer of scene.objects) {
    const entry = resolveAsset(layer.asset);
    if (!entry) {
      console.warn(`[scene-renderer] Skipping layer ${layer.id}: unknown asset ${layer.asset}`);
      continue;
    }
    if (layer.visible === false) continue;
    const el = await getRenderer(layer.type)(layer, entry);
    el.dataset.layerId = layer.id;
    el.style.position = 'absolute';
    if (!layer.position) el.style.inset = '0';
    root.appendChild(el);
  }
}

function reorderChildren(root, layers) {
  const order = layers.map(l => l.id);
  const children = [...root.children];
  const byId = new Map(children.map(c => [c.dataset?.layerId, c]));
  let needsReorder = false;
  for (let i = 0; i < order.length; i++) {
    if (children[i]?.dataset?.layerId !== order[i]) {
      needsReorder = true;
      break;
    }
  }
  if (needsReorder) {
    for (const id of order) {
      const el = byId.get(id);
      if (el) root.appendChild(el);
    }
  }
}
