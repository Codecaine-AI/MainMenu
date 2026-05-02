import { getRenderer } from './asset-renderers/index.js';
import { loadRegistry, resolveAsset } from './asset-registry.js';
import { syncMediaSurface } from './media-surface.js';
import { applyTransform, applyAppearance } from './positioning.js';
import { applyCssEffectProperties } from './asset-renderers/css-effect.js';
import { applyTextProperties } from './asset-renderers/text.js';
import { loadFontAssets } from './font-registry.js';

function isMediaType(type) {
  return type === 'video' || type === 'image' || type === 'media';
}

function renderSignature(obj) {
  return JSON.stringify({
    type: obj.type,
    asset: obj.asset,
    properties: obj.properties ?? null,
  });
}

function shouldRemountObject(el, obj) {
  if (!el) return false;
  if (el.dataset?.layerType && el.dataset.layerType !== obj.type) return true;
  if (el.dataset?.layerAsset && el.dataset.layerAsset !== obj.asset) return true;
  return obj.type === 'component' && el.dataset.renderSignature !== renderSignature(obj);
}

function isAssetlessObject(obj) {
  return obj.type === 'group' || obj.type === 'text';
}

function resolveObjectEntry(obj) {
  if (isAssetlessObject(obj)) return null;
  return resolveAsset(obj.asset);
}

function findMediaEl(el) {
  if (!el) return null;
  if (el.tagName === 'VIDEO' || el.tagName === 'IMG') return el;
  return el.querySelector('video, img');
}

function applyObjectStyles(el, obj, entry) {
  if (obj.visible === false) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  applyTransform(el, obj.transform);

  const isMedia = isMediaType(obj.type);
  const mediaEl = isMedia ? findMediaEl(el) : null;
  if (isMedia) {
    if (typeof obj.appearance?.blend === 'string') {
      el.style.mixBlendMode = obj.appearance.blend;
    }
  } else {
    applyAppearance(el, obj.appearance, { isMedia, mediaEl });
  }
  if (isMedia) {
    syncMediaSurface(el, {
      type: obj.type,
      entry,
      appearance: obj.appearance,
      properties: obj.properties,
    });
  }

  if (isMedia && mediaEl && entry?.file && mediaEl.src && !mediaEl.src.endsWith(entry.file)) {
    mediaEl.src = entry.file;
  }

  if (obj.type === 'glyph-group') {
    updateGlyphGroup(el, obj);
  } else if (obj.type === 'text') {
    applyTextProperties(el, obj);
  } else if (obj.type === 'effect') {
    applyCssEffectProperties(el, obj.properties);
  } else if (Array.isArray(obj.children) && obj.children.length > 0) {
    el.style.position = el.style.position || 'absolute';
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

  for (const slot of (layer.slots ?? [])) {
    const fo = svg.querySelector(`foreignObject [data-layer-id="${slot.id}"]`)?.closest('foreignObject');
    if (fo) updateForeignChild(fo, slot);
  }
}

function updateForeignChild(fo, child) {
  const props = child.properties || {};
  const appearance = child.appearance || {};
  const hasMediaSurface = !!fo.querySelector('[data-media-surface="true"]');
  if (!hasMediaSurface && typeof props.opacity === 'number') fo.style.opacity = String(props.opacity);
  if (!hasMediaSurface && typeof appearance.opacity === 'number') fo.style.opacity = String(appearance.opacity);
  if (typeof props.blend === 'string') fo.style.mixBlendMode = props.blend;
  if (typeof appearance.blend === 'string') fo.style.mixBlendMode = appearance.blend;
  if (typeof props.clip === 'string') {
    fo.setAttribute('clip-path', `url(#${props.clip})`);
  }

  const xhtmlWrap = fo.querySelector('div');
  if (xhtmlWrap && !xhtmlWrap.querySelector('[data-media-surface="true"]')) {
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
    const entry = child.asset ? resolveAsset(child.asset) : null;
    if (entry) {
      const root = fo.querySelector('[data-layer-id]');
      if (root) {
        syncMediaSurface(root, {
          type: child.type === 'image' ? 'image' : 'video',
          entry,
          appearance,
          properties: props,
        });
      }
    }
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

async function mountObject(parent, obj, beforeEl = null) {
  const entry = resolveObjectEntry(obj);
  if (!entry && !isAssetlessObject(obj)) {
    console.warn(`[scene-renderer] Skipping object ${obj.id}: unknown asset ${obj.asset}`);
    return null;
  }
  if (obj.visible === false) return null;

  const wrapper = await getRenderer(obj.type)(obj, entry);
  wrapper.dataset.layerId = obj.id;
  wrapper.dataset.layerType = obj.type;
  if (obj.asset) wrapper.dataset.layerAsset = obj.asset;
  wrapper.dataset.renderSignature = renderSignature(obj);
  if (beforeEl) parent.insertBefore(wrapper, beforeEl);
  else parent.appendChild(wrapper);
  applyObjectStyles(wrapper, obj, entry);

  if (obj.type !== 'glyph-group' && Array.isArray(obj.children) && obj.children.length > 0) {
    wrapper.style.position = wrapper.style.position || 'absolute';
    for (const child of obj.children) {
      await mountObject(wrapper, child);
    }
    reorderChildren(wrapper, obj.children);
  }

  return wrapper;
}

async function remountObject(parent, oldEl, obj) {
  const nextEl = await mountObject(parent, obj, oldEl);
  oldEl.remove();
  return nextEl;
}

async function updateChildren(parentEl, childArray) {
  const existing = new Map();
  for (const el of parentEl.children) {
    const id = el.dataset?.layerId;
    if (id) existing.set(id, el);
  }
  const wantedIds = new Set(childArray.map(c => c.id));

  for (const [id, el] of existing) {
    if (!wantedIds.has(id)) {
      el.remove();
      existing.delete(id);
    }
  }

  for (const child of childArray) {
    const el = existing.get(child.id);
    const entry = resolveObjectEntry(child);
    if (!entry && !isAssetlessObject(child)) continue;
    if (el) {
      if (shouldRemountObject(el, child)) {
        await remountObject(parentEl, el, child);
        continue;
      }
      applyObjectStyles(el, child, entry);
      if (child.type !== 'glyph-group' && Array.isArray(child.children) && child.children.length > 0) {
        await updateChildren(el, child.children);
      }
    } else {
      await mountObject(parentEl, child);
    }
  }

  reorderChildren(parentEl, childArray);
}

export async function renderScene(scene, root) {
  const registry = await loadRegistry();
  await loadFontAssets(registry);

  root.style.width = scene.stage.width + 'px';
  root.style.height = scene.stage.height + 'px';
  applyAppearance(root, scene.appearance);

  const existingTopLevel = new Map();
  for (const child of root.children) {
    const id = child.dataset?.layerId;
    if (id) existingTopLevel.set(id, child);
  }

  if (existingTopLevel.size > 0) {
    await updateChildren(root, scene.objects);
    return;
  }

  root.innerHTML = '';
  for (const obj of scene.objects) {
    await mountObject(root, obj);
  }
  reorderChildren(root, scene.objects);
}

function reorderChildren(parentEl, childArray) {
  const order = childArray.map(c => c.id);
  const children = [...parentEl.children];
  let needsReorder = false;
  for (let i = 0; i < order.length; i++) {
    if (children[i]?.dataset?.layerId !== order[i]) {
      needsReorder = true;
      break;
    }
  }
  if (!needsReorder) return;
  const byId = new Map(children.map(c => [c.dataset?.layerId, c]));
  for (const id of order) {
    const el = byId.get(id);
    if (el) parentEl.appendChild(el);
  }
}
