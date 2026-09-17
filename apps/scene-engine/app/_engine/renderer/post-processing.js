const SVG_NS = 'http://www.w3.org/2000/svg';
const BLEND_MODES = new Set(['screen', 'overlay', 'soft-light', 'multiply', 'normal']);
const MAX_STATIC_PIXELS = 1000000;

let grainFilterId = 0;
const staticLoopStates = new WeakMap();

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function validColor(value) {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : '#000000';
}

function createSvgElement(tagName) {
  return document.createElementNS(SVG_NS, tagName);
}

function createGrain() {
  const filterId = `pp-grain-${++grainFilterId}`;
  const svg = createSvgElement('svg');
  svg.dataset.postProcessingGrain = '';
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = '100%';

  const filter = createSvgElement('filter');
  filter.id = filterId;
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const turbulence = createSvgElement('feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', '7');
  turbulence.setAttribute('stitchTiles', 'stitch');

  const desaturate = createSvgElement('feColorMatrix');
  desaturate.setAttribute('type', 'saturate');
  desaturate.setAttribute('values', '0');

  const transfer = createSvgElement('feComponentTransfer');
  for (const channel of ['R', 'G', 'B']) {
    const fn = createSvgElement(`feFunc${channel}`);
    fn.setAttribute('type', 'linear');
    transfer.appendChild(fn);
  }

  const rect = createSvgElement('rect');
  rect.setAttribute('filter', `url(#${filterId})`);
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', '#fff');

  filter.appendChild(turbulence);
  filter.appendChild(desaturate);
  filter.appendChild(transfer);
  svg.appendChild(filter);
  svg.appendChild(rect);
  return svg;
}

function createStaticCanvas() {
  const canvas = document.createElement('canvas');
  canvas.dataset.postProcessingStatic = '';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.pointerEvents = 'none';
  return canvas;
}

function stopStaticLoop(canvas) {
  const state = staticLoopStates.get(canvas);
  if (!state) return;

  state.running = false;
  state.lastDrawAt = null;
  if (state.frameId !== null) {
    cancelAnimationFrame(state.frameId);
    state.frameId = null;
  }
}

function staticDimensions(overlay, frequency) {
  const width = Math.max(0, overlay.clientWidth || 0);
  const height = Math.max(0, overlay.clientHeight || 0);
  const ratio = (frequency - 0.25) / (1.6 - 0.25);
  let cellSize = Math.max(1, Math.round(6 + (1 - 6) * ratio));
  let internalWidth = Math.max(1, Math.ceil(width / cellSize));
  let internalHeight = Math.max(1, Math.ceil(height / cellSize));

  if (internalWidth * internalHeight > MAX_STATIC_PIXELS) {
    cellSize = Math.max(
      cellSize + 1,
      Math.ceil(Math.sqrt((width * height) / MAX_STATIC_PIXELS)),
      Math.ceil(width / MAX_STATIC_PIXELS),
      Math.ceil(height / MAX_STATIC_PIXELS),
    );
    internalWidth = Math.max(1, Math.ceil(width / cellSize));
    internalHeight = Math.max(1, Math.ceil(height / cellSize));
    while (internalWidth * internalHeight > MAX_STATIC_PIXELS) {
      cellSize += 1;
      internalWidth = Math.max(1, Math.ceil(width / cellSize));
      internalHeight = Math.max(1, Math.ceil(height / cellSize));
    }
  }

  return { width: internalWidth, height: internalHeight };
}

function randomNoiseValue(contrast) {
  const value = Math.min(1, Math.max(0, (Math.random() - 0.5) * contrast + 0.5));
  return Math.round(value * 255);
}

function drawStaticFrame(state) {
  const { width, height } = staticDimensions(state.overlay, state.params.frequency);
  if (!state.context) state.context = state.canvas.getContext('2d');
  if (!state.context) return;

  if (!state.imageData || state.imageData.width !== width || state.imageData.height !== height) {
    state.canvas.width = width;
    state.canvas.height = height;
    state.imageData = state.context.createImageData(width, height);
  }

  const data = state.imageData.data;
  const { colored, contrast } = state.params;
  for (let offset = 0; offset < data.length; offset += 4) {
    const red = randomNoiseValue(contrast);
    data[offset] = red;
    data[offset + 1] = colored ? randomNoiseValue(contrast) : red;
    data[offset + 2] = colored ? randomNoiseValue(contrast) : red;
    data[offset + 3] = 255;
  }
  state.context.putImageData(state.imageData, 0, 0);
}

function startStaticLoop(canvas, overlay, params) {
  let state = staticLoopStates.get(canvas);
  if (!state) {
    state = {
      canvas,
      overlay,
      params: {},
      context: null,
      imageData: null,
      frameId: null,
      lastDrawAt: null,
      running: false,
    };
    staticLoopStates.set(canvas, state);
  }

  state.overlay = overlay;
  Object.assign(state.params, params);
  if (state.running) return;

  state.running = true;
  const tick = (timestamp) => {
    if (!state.running) return;
    if (!canvas.isConnected || !state.overlay.isConnected || !state.params.enabled || !state.params.animated) {
      stopStaticLoop(canvas);
      return;
    }

    const interval = 1000 / state.params.speed;
    if (state.lastDrawAt === null || timestamp - state.lastDrawAt >= interval) {
      drawStaticFrame(state);
      state.lastDrawAt = timestamp;
    }
    state.frameId = requestAnimationFrame(tick);
  };
  state.frameId = requestAnimationFrame(tick);
}

function updateGrain(overlay, settings) {
  let svg = overlay.querySelector('[data-post-processing-grain]');
  let canvas = overlay.querySelector('[data-post-processing-static]');
  if (!settings.enabled) {
    if (svg) svg.style.display = 'none';
    if (canvas) {
      canvas.style.display = 'none';
      const state = staticLoopStates.get(canvas);
      if (state) {
        state.params.enabled = false;
        state.params.animated = false;
      }
      stopStaticLoop(canvas);
    }
    return;
  }

  const opacity = clamp(settings.opacity, 0, 1, 0.075);
  const frequency = clamp(settings.frequency, 0.25, 1.6, 0.8);
  const contrast = clamp(settings.contrast, 0.55, 2.2, 1.3);
  const blend = BLEND_MODES.has(settings.blend) ? settings.blend : 'screen';

  if (settings.animated) {
    if (svg) svg.style.display = 'none';
    if (!canvas) {
      canvas = createStaticCanvas();
      if (svg) overlay.insertBefore(canvas, svg);
      else overlay.appendChild(canvas);
    }

    canvas.style.display = 'block';
    canvas.style.opacity = String(opacity);
    canvas.style.mixBlendMode = blend;
    startStaticLoop(canvas, overlay, {
      enabled: true,
      animated: true,
      speed: clamp(settings.speed, 1, 60, 12),
      colored: !!settings.colored,
      frequency,
      contrast,
      opacity,
      blend,
    });
    return;
  }

  if (canvas) {
    canvas.style.display = 'none';
    const state = staticLoopStates.get(canvas);
    if (state) state.params.animated = false;
    stopStaticLoop(canvas);
  }

  if (!svg) {
    svg = createGrain();
    if (canvas) overlay.insertBefore(svg, canvas);
    else overlay.appendChild(svg);
  }

  const intercept = (1 - contrast) / 2;

  svg.style.display = 'block';
  svg.style.opacity = String(opacity);
  svg.style.mixBlendMode = blend;
  svg.querySelector('feTurbulence').setAttribute('baseFrequency', String(frequency));
  for (const fn of svg.querySelectorAll('feFuncR, feFuncG, feFuncB')) {
    fn.setAttribute('slope', String(contrast));
    fn.setAttribute('intercept', String(intercept));
  }
}

function updateVignette(overlay, settings) {
  let vignette = overlay.querySelector('[data-post-processing-vignette]');
  if (!settings.enabled) {
    if (vignette) vignette.style.display = 'none';
    return;
  }

  if (!vignette) {
    vignette = document.createElement('div');
    vignette.dataset.postProcessingVignette = '';
    vignette.style.position = 'absolute';
    vignette.style.inset = '0';
    overlay.appendChild(vignette);
  }

  const intensity = clamp(settings.intensity, 0, 1, 0.35);
  const size = clamp(settings.size, 0, 1, 0.6);
  const color = validColor(settings.color);
  vignette.style.display = 'block';
  vignette.style.background = `radial-gradient(ellipse at center, transparent ${size * 100}%, ${color} 100%)`;
  vignette.style.opacity = String(intensity);
}

export function applyPostProcessing(root, settings) {
  let overlay = root.querySelector(':scope > [data-post-processing]');
  const grainEnabled = !!settings?.grain?.enabled;
  const vignetteEnabled = !!settings?.vignette?.enabled;

  if (!settings?.enabled || (!grainEnabled && !vignetteEnabled)) {
    overlay?.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.dataset.postProcessing = '';
    overlay.style.position = 'absolute';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    // No data-layer-id: scene reconciliation only owns scene layer elements.
    root.appendChild(overlay);
  }

  updateGrain(overlay, settings.grain || {});
  updateVignette(overlay, settings.vignette || {});
}
