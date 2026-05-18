import { resolveRuntimeUrl } from './runtime-url.js';

const VIDEO_TILER = Symbol('videoTiler');

function clampRepeat(value) {
  const n = Math.round(Number(value ?? 1));
  return Number.isFinite(n) ? Math.max(1, Math.min(40, n)) : 1;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mediaSource(entry) {
  return resolveRuntimeUrl(entry?.file ?? entry?.path ?? '');
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

function drawObjectFit(ctx, source, x, y, width, height, fit) {
  const sourceWidth = source.videoWidth || source.naturalWidth || width;
  const sourceHeight = source.videoHeight || source.naturalHeight || height;
  if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return;

  if (fit === 'fill') {
    ctx.drawImage(source, x, y, width, height);
    return;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  const useCover = fit !== 'contain';
  const fitByWidth = useCover ? sourceRatio < targetRatio : sourceRatio > targetRatio;
  const drawWidth = fitByWidth ? width : height * sourceRatio;
  const drawHeight = fitByWidth ? width / sourceRatio : height;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

function sizeCanvas(canvas, ctx, width, height) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawVideoTiler(state) {
  const { surface, canvas, ctx, video } = state;
  const rect = surface.getBoundingClientRect();
  const width = surface.clientWidth || rect.width;
  const height = surface.clientHeight || rect.height;
  if (width <= 0 || height <= 0) return;

  sizeCanvas(canvas, ctx, width, height);
  ctx.clearRect(0, 0, width, height);
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

  const tileWidth = width / state.repeatX;
  const tileHeight = height / state.repeatY;
  for (let y = 0; y < state.repeatY; y += 1) {
    for (let x = 0; x < state.repeatX; x += 1) {
      drawObjectFit(ctx, video, x * tileWidth, y * tileHeight, tileWidth, tileHeight, state.fit);
    }
  }
}

function stopVideoTiler(surface) {
  const state = surface[VIDEO_TILER];
  if (!state) return;
  state.running = false;
  if (state.frameHandle && typeof state.video.cancelVideoFrameCallback === 'function') {
    state.video.cancelVideoFrameCallback(state.frameHandle);
  }
  if (state.raf) cancelAnimationFrame(state.raf);
  state.video.pause?.();
  state.video.remove();
  state.canvas.remove();
  delete surface[VIDEO_TILER];
}

function scheduleVideoTiler(state) {
  if (!state.running) return;
  if (!state.surface.isConnected) {
    state.running = false;
    return;
  }

  drawVideoTiler(state);
  if (typeof state.video.requestVideoFrameCallback === 'function') {
    state.frameHandle = state.video.requestVideoFrameCallback(() => scheduleVideoTiler(state));
    return;
  }
  state.raf = requestAnimationFrame(() => scheduleVideoTiler(state));
}

function startVideoTiler(state) {
  if (state.running) return;
  state.running = true;
  scheduleVideoTiler(state);
}

function ensureVideoTiler(surface, source) {
  let state = surface[VIDEO_TILER];
  if (!state) {
    const video = createLeaf('video', source);
    video.dataset.videoTilerSource = 'true';
    video.setAttribute('aria-hidden', 'true');
    video.style.position = 'absolute';
    video.style.left = '0';
    video.style.top = '0';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';

    const canvas = document.createElement('canvas');
    canvas.dataset.videoTilerCanvas = 'true';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';

    surface.append(video, canvas);
    state = {
      surface,
      video,
      canvas,
      ctx: canvas.getContext('2d'),
      repeatX: 1,
      repeatY: 1,
      fit: 'cover',
      source: '',
      running: false,
      frameHandle: 0,
      raf: 0,
    };
    surface[VIDEO_TILER] = state;
    video.addEventListener('loadedmetadata', () => drawVideoTiler(state));
    video.addEventListener('play', () => startVideoTiler(state));
  }

  if (source && state.source !== source) {
    state.source = source;
    state.video.src = source;
    state.video.load?.();
  }
  return state;
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
  surface.style.transform = `translate(${positionX}%, ${positionY}%) scale(${scale}) rotate(${rotation}deg)`;
  surface.style.transformOrigin = 'center center';

  const tiler = surface[VIDEO_TILER];
  if (tiler) {
    surface.style.display = 'block';
    surface.style.gridTemplateColumns = '';
    surface.style.gridTemplateRows = '';
    tiler.repeatX = repeatX;
    tiler.repeatY = repeatY;
    tiler.fit = fit;
    tiler.canvas.style.opacity = opacity == null ? '' : String(opacity);
    tiler.canvas.style.filter = hue !== 0 ? `hue-rotate(${hue}deg)` : '';
    tiler.video.playbackRate = speed;
    tiler.video.play?.().catch(() => {});
    startVideoTiler(tiler);
    drawVideoTiler(tiler);
    return;
  }

  surface.style.display = repeatX > 1 || repeatY > 1 ? 'grid' : 'block';
  surface.style.gridTemplateColumns = repeatX > 1 || repeatY > 1 ? `repeat(${repeatX}, 1fr)` : '';
  surface.style.gridTemplateRows = repeatX > 1 || repeatY > 1 ? `repeat(${repeatY}, 1fr)` : '';

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
  const useVideoTiler = mediaType === 'video' && targetCount > 1;

  let surface = root.querySelector(':scope > [data-media-surface="true"]');
  if (!surface) {
    surface = document.createElement('div');
    surface.dataset.mediaSurface = 'true';
    root.appendChild(surface);
  }

  if (useVideoTiler) {
    surface.querySelectorAll(':scope > img, :scope > video:not([data-video-tiler-source="true"])')
      .forEach((leaf) => leaf.remove());
    surface.querySelectorAll(':scope > canvas:not([data-video-tiler-canvas="true"])')
      .forEach((leaf) => leaf.remove());
    ensureVideoTiler(surface, source);
    applyMediaSurface(surface, config);
    return surface;
  }

  stopVideoTiler(surface);

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
