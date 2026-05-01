function clampRepeat(value) {
  const n = Math.round(Number(value ?? 1));
  return Number.isFinite(n) ? Math.max(1, Math.min(8, n)) : 1;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mediaSource(entry) {
  return entry?.file ?? entry?.path ?? '';
}

function createLeaf(type, src) {
  const leaf = document.createElement(type === 'image' ? 'img' : 'video');
  if (type === 'image') {
    leaf.src = src;
  } else {
    leaf.src = src;
    leaf.autoplay = true;
    leaf.muted = true;
    leaf.loop = true;
    leaf.playsInline = true;
    leaf.preload = 'auto';
  }
  leaf.style.width = '100%';
  leaf.style.height = '100%';
  leaf.style.display = 'block';
  return leaf;
}

export function applyMediaSurface(surface, config = {}) {
  const props = config.properties ?? {};
  const appearance = config.appearance ?? {};
  const repeatX = clampRepeat(props.repeat_x);
  const repeatY = clampRepeat(props.repeat_y);
  const fit = appearance.fit ?? 'cover';
  const hue = num(appearance.hue, 0);
  const opacity = typeof appearance.opacity === 'number' ? appearance.opacity : null;
  const speed = num(props.speed, 1);
  const positionX = num(props.position_x, 0);
  const positionY = num(props.position_y, 0);
  const scale = num(props.scale, 1);
  const rotation = num(props.rotation, 0);

  surface.style.width = '100%';
  surface.style.height = '100%';
  surface.style.position = 'relative';
  surface.style.overflow = 'hidden';
  surface.style.display = repeatX > 1 || repeatY > 1 ? 'grid' : 'block';
  surface.style.gridTemplateColumns = repeatX > 1 || repeatY > 1 ? `repeat(${repeatX}, 1fr)` : '';
  surface.style.gridTemplateRows = repeatX > 1 || repeatY > 1 ? `repeat(${repeatY}, 1fr)` : '';
  surface.style.transform = `translate(${positionX}%, ${positionY}%) scale(${scale}) rotate(${rotation}deg)`;
  surface.style.transformOrigin = 'center center';

  const leaves = surface.querySelectorAll('video, img');
  leaves.forEach((leaf) => {
    leaf.style.objectFit = fit;
    leaf.style.opacity = opacity == null ? '' : String(opacity);
    leaf.style.filter = hue !== 0 ? `hue-rotate(${hue}deg)` : '';
    if (leaf.tagName === 'VIDEO') {
      leaf.playbackRate = speed;
      leaf.play?.().catch(() => {});
    }
  });
}

export function syncMediaSurface(root, config = {}) {
  const source = mediaSource(config.entry);
  const mediaType = config.type === 'image' ? 'image' : 'video';
  const props = config.properties ?? {};
  const repeatX = clampRepeat(props.repeat_x);
  const repeatY = clampRepeat(props.repeat_y);
  const targetCount = repeatX * repeatY;

  let surface = root.querySelector(':scope > [data-media-surface="true"]');
  if (!surface) {
    surface = document.createElement('div');
    surface.dataset.mediaSurface = 'true';
    root.appendChild(surface);
  }

  const selector = mediaType === 'image' ? 'img' : 'video';
  const staleSelector = mediaType === 'image' ? 'video' : 'img';
  surface.querySelectorAll(staleSelector).forEach((leaf) => leaf.remove());

  let leaves = [...surface.querySelectorAll(selector)];
  while (leaves.length > targetCount) {
    leaves.pop()?.remove();
  }
  while (leaves.length < targetCount) {
    const leaf = createLeaf(mediaType, source);
    surface.appendChild(leaf);
    leaves.push(leaf);
  }
  leaves.forEach((leaf) => {
    if (source && !leaf.src.endsWith(source)) leaf.src = source;
  });

  applyMediaSurface(surface, config);
  return surface;
}
