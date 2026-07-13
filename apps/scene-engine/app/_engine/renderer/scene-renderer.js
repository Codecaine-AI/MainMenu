import { getRenderer } from './asset-renderers/index.js';
import { loadRegistry, resolveAsset } from './asset-registry.js';
import { syncMediaSurface } from './media-surface.js';
import { applyTransform, applyAppearance } from './positioning.js';
import { applyCssEffectProperties } from './asset-renderers/css-effect.js';
import { applyTextProperties } from './asset-renderers/text.js';
import { loadFontAssets } from './font-registry.js';
import { bindObjectEvents, primeEventAudio } from './event-runtime.js';
import { resolveRuntimeUrl } from './runtime-url.js';
import { applyPostProcessing } from './post-processing.js';

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

function applyObjectStyles(el, obj, entry, options = {}) {
  if (obj.type === 'audio' && typeof el.setAudioProperties === 'function') {
    el.setAudioProperties(obj.properties || {});
  }

  if (obj.visible === false) {
    el.style.display = 'none';
    if (obj.type !== 'audio') {
      bindObjectEvents(el, obj, { ...options, events: false });
      return;
    }
  } else {
    el.style.display = '';
  }

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

  if (isMedia && mediaEl && entry?.file) {
    const src = resolveRuntimeUrl(entry.file);
    if (mediaEl.getAttribute('src') && mediaEl.getAttribute('src') !== src) mediaEl.src = src;
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

  bindObjectEvents(el, obj, options);
}

function updateGlyphGroup(wrapper, layer) {
  const parentPath = wrapper.dataset.scenePath ?? '';
  const svg = wrapper.querySelector('svg');
  if (!svg) return;

  const scope = 'melee3';
  const childList = layer.children ?? [];
  for (let i = 0; i < childList.length; i++) {
    const child = childList[i];
    if (child.layer) {
      const matched = svg.querySelector(`[data-layer="${child.layer}"]`);
      if (!matched) continue;
      matched.style.display = child.visible === false ? 'none' : '';
      matched.dataset.scenePath = `${parentPath}.children.${i}`;
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
      if (fo) {
        fo.dataset.scenePath = `${parentPath}.children.${i}`;
        updateForeignChild(fo, child);
      }
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

async function mountObject(parent, obj, beforeEl = null, path = '', options = {}) {
  const entry = resolveObjectEntry(obj);
  if (!entry && !isAssetlessObject(obj)) {
    console.warn(`[scene-renderer] Skipping object ${obj.id}: unknown asset ${obj.asset}`);
    return null;
  }
  if (obj.visible === false && obj.type !== 'audio') return null;

  const wrapper = await getRenderer(obj.type)(obj, entry, options);
  wrapper.dataset.layerId = obj.id;
  wrapper.dataset.scenePath = path;
  wrapper.dataset.layerType = obj.type;
  if (obj.asset) wrapper.dataset.layerAsset = obj.asset;
  wrapper.dataset.renderSignature = renderSignature(obj);
  if (beforeEl) parent.insertBefore(wrapper, beforeEl);
  else parent.appendChild(wrapper);
  applyObjectStyles(wrapper, obj, entry, options);

  if (obj.type !== 'glyph-group' && Array.isArray(obj.children) && obj.children.length > 0) {
    wrapper.style.position = wrapper.style.position || 'absolute';
    for (let i = 0; i < obj.children.length; i++) {
      await mountObject(wrapper, obj.children[i], null, `${path}.children.${i}`, options);
    }
    reorderChildren(wrapper, obj.children, path);
  }

  return wrapper;
}

async function remountObject(parent, oldEl, obj, path = '', options = {}) {
  const nextEl = await mountObject(parent, obj, oldEl, path, options);
  oldEl.remove();
  return nextEl;
}

async function updateChildren(parentEl, childArray, parentPath = '', options = {}) {
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

  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];
    const childPath = parentPath === '' ? String(i) : `${parentPath}.children.${i}`;
    const el = existing.get(child.id);
    const entry = resolveObjectEntry(child);
    if (!entry && !isAssetlessObject(child)) continue;
    if (el) {
      if (shouldRemountObject(el, child)) {
        await remountObject(parentEl, el, child, childPath, options);
        continue;
      }
      el.dataset.scenePath = childPath;
      applyObjectStyles(el, child, entry, options);
      if (child.type !== 'glyph-group' && Array.isArray(child.children) && child.children.length > 0) {
        await updateChildren(el, child.children, childPath, options);
      }
    } else {
      await mountObject(parentEl, child, null, childPath, options);
    }
  }

  reorderChildren(parentEl, childArray, parentPath);
}

function playEntrance(root, scene) {
  const config = scene.entrance
  const stagger = config.stagger ?? 200
  const defaultDuration = config.duration ?? 600
  const defaultType = config.type ?? 'fade-in'

  const entries = []
  for (let i = 0; i < scene.objects.length; i++) {
    const obj = scene.objects[i]
    if (obj.visible === false) continue
    const objEntrance = obj.entrance ?? {}
    const type = objEntrance.type ?? defaultType
    if (type === 'none') continue

    const el = root.querySelector(`[data-layer-id="${obj.id}"]`)
    if (!el) continue

    const duration = objEntrance.duration ?? defaultDuration
    const delay = stagger * i + (objEntrance.delay ?? 0)
    const targetOpacity = obj.appearance?.opacity ?? 1
    entries.push({ el, duration, delay, targetOpacity })
  }

  if (entries.length === 0) return Promise.resolve()

  for (const e of entries) {
    e.el.style.opacity = '0'
    e.el.style.transition = `opacity ${e.duration}ms ease-out ${e.delay}ms`
  }

  void root.offsetHeight

  for (const e of entries) {
    e.el.style.opacity = String(e.targetOpacity)
  }

  const maxEnd = Math.max(...entries.map(e => e.delay + e.duration))
  return new Promise((resolve) => {
    setTimeout(() => {
      for (const e of entries) {
        e.el.style.transition = ''
      }
      resolve()
    }, maxEnd + 50)
  })
}

export async function renderScene(scene, root, options = {}) {
  const registry = await loadRegistry({ projectId: options.projectId ?? options.runtime?.projectId });
  await loadFontAssets(registry);
  // Site runtimes (which set MELEE_BUNDLE_ROOT) prime event audio; the editor skips it.
  if (typeof window !== 'undefined' && window.MELEE_BUNDLE_ROOT) {
    primeEventAudio(registry);
  }

  root.style.width = scene.stage.width + 'px';
  root.style.height = scene.stage.height + 'px';
  applyAppearance(root, scene.appearance);

  const existingTopLevel = new Map();
  for (const child of root.children) {
    const id = child.dataset?.layerId;
    if (id) existingTopLevel.set(id, child);
  }

  if (existingTopLevel.size > 0) {
    await updateChildren(root, scene.objects, '', options);
  } else {
    root.style.visibility = 'hidden';
    root.innerHTML = '';
    for (let i = 0; i < scene.objects.length; i++) {
      await mountObject(root, scene.objects[i], null, String(i), options);
    }
    reorderChildren(root, scene.objects, '');

    if (scene.entrance && !options.skipEntrance) {
      root.style.visibility = '';
      await playEntrance(root, scene);
    } else {
      root.style.visibility = '';
    }
  }

  applyPostProcessing(root, options.postProcessing);
}

function reorderChildren(parentEl, childArray, parentPath = '') {
  const order = childArray.map(c => c.id);
  const children = [...parentEl.children];
  let needsReorder = false;
  for (let i = 0; i < order.length; i++) {
    if (children[i]?.dataset?.layerId !== order[i]) {
      needsReorder = true;
      break;
    }
  }
  const byId = new Map(children.map(c => [c.dataset?.layerId, c]));
  if (needsReorder) {
    for (const id of order) {
      const el = byId.get(id);
      if (el) parentEl.appendChild(el);
    }
  }
  for (let i = 0; i < order.length; i++) {
    const el = byId.get(order[i]);
    if (el) {
      el.dataset.scenePath = parentPath === '' ? String(i) : `${parentPath}.children.${i}`;
    }
  }
}
