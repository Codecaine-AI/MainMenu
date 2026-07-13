const SVG_NS = 'http://www.w3.org/2000/svg';
const BLEND_MODES = new Set(['screen', 'overlay', 'soft-light', 'multiply', 'normal']);

let grainFilterId = 0;

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

function updateGrain(overlay, settings) {
  let svg = overlay.querySelector('[data-post-processing-grain]');
  if (!settings.enabled) {
    if (svg) svg.style.display = 'none';
    return;
  }

  if (!svg) {
    svg = createGrain();
    overlay.appendChild(svg);
  }

  const opacity = clamp(settings.opacity, 0, 0.35, 0.075);
  const frequency = clamp(settings.frequency, 0.25, 1.6, 0.8);
  const contrast = clamp(settings.contrast, 0.55, 2.2, 1.3);
  const blend = BLEND_MODES.has(settings.blend) ? settings.blend : 'screen';
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
