const SVG_NS = 'http://www.w3.org/2000/svg';
const TEMPLATE_URL = '/modules/components/side-menu/side-menu.svg';

let templatePromise = null;
let instanceCounter = 0;

const DEFAULT_ITEMS = ['Regular Match', 'Event Match', 'Stadium', 'Training'];
const PANEL_RAIN_BOUNDS = {
  x: 961,
  y: 296,
  width: 362,
  height: 455,
};

const DEFAULTS = {
  items: DEFAULT_ITEMS.join('|'),
  'item-count': 4,
  'global-x': 0,
  'global-y': 0,
  scale: 1,
  perspective: 1700,
  'panel-depth': -42,
  'frame-depth': 8,
  'panel-rotate-x': 0,
  'panel-rotate-y': -5,
  'panel-rotate-z': 0,
  'frame-rotate-x': 0,
  'frame-rotate-y': -2,
  'frame-rotate-z': 0,
  'panel-origin-x': 1130,
  'panel-origin-y': 525,
  'frame-origin-x': 942,
  'frame-origin-y': 586,
  'panel-color': '#07515b',
  'panel-edge-color': '#167783',
  'panel-opacity': 0.72,
  'panel-edge-opacity': 0.78,
  'rain-density': 36,
  'rain-speed': 0.9,
  'rain-color-offset': 0.36,
  'rain-x-scale': 1,
  'rain-y-scale': 1,
  'frame-visible': true,
  'frame-color': '#b8bbc2',
  'frame-opacity': 0.78,
  'text-color': '#dce0ee',
  'text-opacity': 1,
  'text-shadow-color': 'rgba(0, 0, 0, 0.6)',
  'rail-visible': true,
  'rail-text': 'START PAUSE',
  'rail-text-color': '#aaaeb6',
  'rail-text-opacity': 1,
  'rail-x': 884,
  'rail-y': 565,
  'rail-rotation': -90,
  'rail-font-size': 29,
  'content-x': 1027,
  'content-y': 414,
  'content-width': 240,
  'content-line-height': 70,
  'content-font-size': 43,
  'content-type': 'rows',
  'content-visible': true,
  'text-auto-fit': true,
  'text-min-font-size': 28,
  'text-max-font-size': 54,
  'image-src': '',
  'image-x': 990,
  'image-y': 360,
  'image-width': 278,
  'image-height': 238,
  'image-opacity': 0.92,
};

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function numberProp(properties, key, fallback) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  if (typeof properties[key] === 'boolean') return properties[key];
  if (properties[key] === 'true') return true;
  if (properties[key] === 'false') return false;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashUnit(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function parseCssColor(value) {
  const text = String(value ?? '').trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
    };
  }

  const rgb = text.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (rgb) {
    return {
      r: clamp(Math.round(Number(rgb[1])), 0, 255),
      g: clamp(Math.round(Number(rgb[2])), 0, 255),
      b: clamp(Math.round(Number(rgb[3])), 0, 255),
    };
  }

  return null;
}

function mixTowardWhite(color, offset) {
  const amount = clamp(offset, 0, 1);
  const rgb = parseCssColor(color);
  if (!rgb) {
    const whitePercent = Math.round(amount * 100);
    return `color-mix(in srgb, ${color} ${100 - whitePercent}%, #ffffff ${whitePercent}%)`;
  }

  const r = Math.round(rgb.r + (255 - rgb.r) * amount);
  const g = Math.round(rgb.g + (255 - rgb.g) * amount);
  const b = Math.round(rgb.b + (255 - rgb.b) * amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function rainDensity(properties) {
  return clamp(Math.round(numberProp(properties, 'rain-density', DEFAULTS['rain-density'])), 0, 160);
}

function rainDurationSeconds(properties) {
  const speed = clamp(numberProp(properties, 'rain-speed', DEFAULTS['rain-speed']), 0.05, 5);
  return clamp(7.5 / speed, 1.5, 60);
}

function rainColor(properties) {
  const panelColor = stringProp(properties, 'panel-color', DEFAULTS['panel-color']);
  const offset = numberProp(properties, 'rain-color-offset', DEFAULTS['rain-color-offset']);
  return mixTowardWhite(panelColor, offset);
}

function rainScale(properties, key) {
  return clamp(numberProp(properties, key, DEFAULTS[key]), 0.1, 8);
}

function cssPx(root, name, value) {
  root.style.setProperty(name, `${value}px`);
}

function cssDeg(root, name, value) {
  root.style.setProperty(name, `${value}deg`);
}

function estimateTextLength(text, fontSize) {
  const weightedLength = Array.from(text).reduce((total, char) => {
    if (char === ' ') return total + 0.34;
    if (char === '-' || char === '.' || char === ',') return total + 0.32;
    if (/[1Iijl]/.test(char)) return total + 0.34;
    if (/[MW]/.test(char)) return total + 0.86;
    if (/[A-Z]/.test(char)) return total + 0.62;
    return total + 0.54;
  }, 0);

  return weightedLength * fontSize;
}

function fitLabelText(label) {
  if (label.dataset.sideMenuFitEnabled !== 'true') return;

  const availableWidth = Number(label.dataset.sideMenuFitWidth);
  const baseFontSize = Number(label.dataset.sideMenuFitBase);
  const minFontSize = Number(label.dataset.sideMenuFitMin);
  const maxFontSize = Number(label.dataset.sideMenuFitMax);
  if (![availableWidth, baseFontSize, minFontSize, maxFontSize].every(Number.isFinite)) return;

  const targetFontSize = clamp(baseFontSize, minFontSize, maxFontSize);
  label.setAttribute('font-size', targetFontSize.toFixed(3));

  let measuredWidth = estimateTextLength(label.textContent || '', targetFontSize);
  if (typeof label.getComputedTextLength === 'function') {
    try {
      const renderedWidth = label.getComputedTextLength();
      if (Number.isFinite(renderedWidth) && renderedWidth > 0) measuredWidth = renderedWidth;
    } catch {
      // Detached SVG text can fail measurement before the scene mounts.
    }
  }
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0 || measuredWidth <= availableWidth) return;

  const fittedFontSize = clamp(targetFontSize * (availableWidth / measuredWidth), minFontSize, targetFontSize);
  label.setAttribute('font-size', fittedFontSize.toFixed(3));
}

function fitLabels(root) {
  root.querySelectorAll('.side-menu__item-label').forEach(fitLabelText);
}

function queueLabelFit(root) {
  if (typeof requestAnimationFrame !== 'function') {
    fitLabels(root);
    return;
  }

  requestAnimationFrame(() => {
    fitLabels(root);
    requestAnimationFrame(() => fitLabels(root));
  });

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => fitLabels(root)).catch(() => {});
  }
}

async function loadTemplate() {
  if (!templatePromise) {
    templatePromise = fetch(TEMPLATE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${TEMPLATE_URL}: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) throw new Error(`Invalid SVG in ${TEMPLATE_URL}`);
        const panel = doc.querySelector('.side-menu__geometry-panel');
        const frame = doc.querySelector('.side-menu__geometry-frame');
        if (!panel || !frame) throw new Error(`Missing side-menu geometry in ${TEMPLATE_URL}`);
        return { panel, frame };
      })
      .catch((err) => {
        templatePromise = null;
        throw err;
      });
  }

  return templatePromise;
}

function parseItems(properties) {
  if (!booleanProp(properties, 'content-visible', DEFAULTS['content-visible'])) return [];

  const fromList = stringProp(properties, 'items', DEFAULTS.items)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const count = clamp(
    Math.round(numberProp(properties, 'item-count', fromList.length || DEFAULTS['item-count'])),
    0,
    6,
  );

  return Array.from({ length: count }, (_, index) => {
    const fallback = fromList[index] ?? DEFAULT_ITEMS[index] ?? `Item ${index + 1}`;
    return stringProp(properties, `item-${index + 1}`, fallback).trim();
  }).filter(Boolean);
}

function applyCssProperties(root, properties) {
  cssPx(root, '--side-menu-stage-x', clamp(numberProp(properties, 'global-x', DEFAULTS['global-x']), -600, 600));
  cssPx(root, '--side-menu-stage-y', clamp(numberProp(properties, 'global-y', DEFAULTS['global-y']), -600, 600));
  root.style.setProperty('--side-menu-stage-scale', String(clamp(numberProp(properties, 'scale', DEFAULTS.scale), 0.25, 2)));
  cssPx(root, '--side-menu-perspective', clamp(numberProp(properties, 'perspective', DEFAULTS.perspective), 400, 4000));

  cssPx(root, '--side-menu-panel-z', clamp(numberProp(properties, 'panel-depth', DEFAULTS['panel-depth']), -500, 500));
  cssPx(root, '--side-menu-frame-z', clamp(numberProp(properties, 'frame-depth', DEFAULTS['frame-depth']), -500, 500));
  cssDeg(root, '--side-menu-panel-rotate-x', clamp(numberProp(properties, 'panel-rotate-x', DEFAULTS['panel-rotate-x']), -65, 65));
  cssDeg(root, '--side-menu-panel-rotate-y', clamp(numberProp(properties, 'panel-rotate-y', DEFAULTS['panel-rotate-y']), -65, 65));
  cssDeg(root, '--side-menu-panel-rotate-z', clamp(numberProp(properties, 'panel-rotate-z', DEFAULTS['panel-rotate-z']), -45, 45));
  cssDeg(root, '--side-menu-frame-rotate-x', clamp(numberProp(properties, 'frame-rotate-x', DEFAULTS['frame-rotate-x']), -65, 65));
  cssDeg(root, '--side-menu-frame-rotate-y', clamp(numberProp(properties, 'frame-rotate-y', DEFAULTS['frame-rotate-y']), -65, 65));
  cssDeg(root, '--side-menu-frame-rotate-z', clamp(numberProp(properties, 'frame-rotate-z', DEFAULTS['frame-rotate-z']), -45, 45));
  cssPx(root, '--side-menu-panel-origin-x', clamp(numberProp(properties, 'panel-origin-x', DEFAULTS['panel-origin-x']), 0, 1440));
  cssPx(root, '--side-menu-panel-origin-y', clamp(numberProp(properties, 'panel-origin-y', DEFAULTS['panel-origin-y']), 0, 1080));
  cssPx(root, '--side-menu-frame-origin-x', clamp(numberProp(properties, 'frame-origin-x', DEFAULTS['frame-origin-x']), 0, 1440));
  cssPx(root, '--side-menu-frame-origin-y', clamp(numberProp(properties, 'frame-origin-y', DEFAULTS['frame-origin-y']), 0, 1080));

  root.style.setProperty('--side-menu-panel', stringProp(properties, 'panel-color', DEFAULTS['panel-color']));
  root.style.setProperty('--side-menu-panel-edge', stringProp(properties, 'panel-edge-color', DEFAULTS['panel-edge-color']));
  root.style.setProperty('--side-menu-rain-color', rainColor(properties));
  root.style.setProperty('--side-menu-rain-duration', `${rainDurationSeconds(properties).toFixed(3)}s`);
  root.style.setProperty(
    '--side-menu-panel-opacity',
    String(clamp(numberProp(properties, 'panel-opacity', DEFAULTS['panel-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--side-menu-panel-edge-opacity',
    String(clamp(numberProp(properties, 'panel-edge-opacity', DEFAULTS['panel-edge-opacity']), 0, 1)),
  );
  root.style.setProperty('--side-menu-frame', stringProp(properties, 'frame-color', DEFAULTS['frame-color']));
  root.style.setProperty(
    '--side-menu-frame-opacity',
    String(clamp(numberProp(properties, 'frame-opacity', DEFAULTS['frame-opacity']), 0, 1)),
  );
  root.style.setProperty('--side-menu-text', stringProp(properties, 'text-color', DEFAULTS['text-color']));
  root.style.setProperty(
    '--side-menu-text-opacity',
    String(clamp(numberProp(properties, 'text-opacity', DEFAULTS['text-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--side-menu-text-shadow',
    stringProp(properties, 'text-shadow-color', DEFAULTS['text-shadow-color']),
  );
  root.style.setProperty('--side-menu-rail-text', stringProp(properties, 'rail-text-color', DEFAULTS['rail-text-color']));
  root.style.setProperty(
    '--side-menu-rail-text-opacity',
    String(clamp(numberProp(properties, 'rail-text-opacity', DEFAULTS['rail-text-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--side-menu-rail-font-size',
    `${clamp(numberProp(properties, 'rail-font-size', DEFAULTS['rail-font-size']), 12, 80)}px`,
  );
}

function createSvg(className) {
  return svgEl('svg', {
    class: `side-menu__svg ${className}`,
    viewBox: '0 0 1440 1080',
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });
}

function appendPanelRain(svg, panelGroup, properties, instanceId) {
  const density = rainDensity(properties);
  if (density <= 0) return;

  const panelFill = panelGroup.querySelector('.side-menu__panel-fill');
  if (!panelFill) return;

  const panelPath = panelFill.getAttribute('d');
  if (!panelPath) return;

  const clipId = `side-menu-rain-clip-${instanceId}`;
  const defs = svgEl('defs');
  const clipPath = svgEl('clipPath', { id: clipId });
  clipPath.appendChild(svgEl('path', { d: panelPath }));
  defs.appendChild(clipPath);
  svg.insertBefore(defs, svg.firstChild);

  const rain = svgEl('g', {
    class: 'side-menu__rain',
    'clip-path': `url(#${clipId})`,
  });
  const duration = rainDurationSeconds(properties);
  const xScale = rainScale(properties, 'rain-x-scale');
  const yScale = rainScale(properties, 'rain-y-scale');

  for (let index = 0; index < density; index += 1) {
    const x = PANEL_RAIN_BOUNDS.x + 8 + hashUnit(index, 1) * (PANEL_RAIN_BOUNDS.width - 16);
    const y = PANEL_RAIN_BOUNDS.y + hashUnit(index, 2) * PANEL_RAIN_BOUNDS.height;
    const isPixel = hashUnit(index, 3) < 0.3;
    const baseWidth = isPixel ? 2 + Math.floor(hashUnit(index, 4) * 3) : 2 + Math.floor(hashUnit(index, 4) * 4);
    const baseHeight = isPixel ? baseWidth : 8 + Math.floor(hashUnit(index, 5) * 28);
    const width = clamp(baseWidth * xScale, 1, 80);
    const height = clamp(baseHeight * yScale, 1, 80);
    const alpha = 0.14 + hashUnit(index, 6) * 0.34;
    const drift = (hashUnit(index, 7) - 0.5) * 14;
    const delay = -hashUnit(index, 8) * duration;

    const drop = svgEl('rect', {
      class: 'side-menu__rain-drop',
      x: x.toFixed(2),
      y: y.toFixed(2),
      width: width.toFixed(2),
      height: height.toFixed(2),
      rx: Math.min(width / 2, height / 2, 1.5).toFixed(2),
    });
    drop.style.setProperty('--side-menu-rain-alpha', alpha.toFixed(3));
    drop.style.setProperty('--side-menu-rain-delay', `${delay.toFixed(3)}s`);
    drop.style.setProperty('--side-menu-rain-drift', `${drift.toFixed(2)}px`);
    rain.appendChild(drop);
  }

  const panelEdge = panelGroup.querySelector('.side-menu__panel-edge');
  panelGroup.insertBefore(rain, panelEdge ?? null);
}

function appendItems(svg, properties) {
  if (stringProp(properties, 'content-type', DEFAULTS['content-type']) !== 'rows') return [];

  const items = parseItems(properties);
  const x = clamp(numberProp(properties, 'content-x', DEFAULTS['content-x']), 0, 1440);
  const y = clamp(numberProp(properties, 'content-y', DEFAULTS['content-y']), 0, 1080);
  const width = clamp(numberProp(properties, 'content-width', DEFAULTS['content-width']), 48, 600);
  const lineHeight = clamp(numberProp(properties, 'content-line-height', DEFAULTS['content-line-height']), 24, 180);
  const baseFontSize = clamp(numberProp(properties, 'content-font-size', DEFAULTS['content-font-size']), 12, 120);
  const minFontSize = clamp(numberProp(properties, 'text-min-font-size', DEFAULTS['text-min-font-size']), 8, 120);
  const maxFontSize = clamp(numberProp(properties, 'text-max-font-size', DEFAULTS['text-max-font-size']), minFontSize, 140);
  const fitEnabled = booleanProp(properties, 'text-auto-fit', DEFAULTS['text-auto-fit']);

  items.forEach((item, index) => {
    const label = svgEl('text', {
      class: 'side-menu__item-label',
      x,
      y: y + index * lineHeight,
      'dominant-baseline': 'middle',
      'text-anchor': 'start',
      'font-size': clamp(baseFontSize, minFontSize, maxFontSize).toFixed(3),
    });
    label.textContent = item;
    label.dataset.sideMenuFitEnabled = fitEnabled ? 'true' : 'false';
    label.dataset.sideMenuFitWidth = String(width);
    label.dataset.sideMenuFitBase = String(baseFontSize);
    label.dataset.sideMenuFitMin = String(minFontSize);
    label.dataset.sideMenuFitMax = String(maxFontSize);
    svg.appendChild(label);
  });

  return items;
}

function appendImage(svg, properties) {
  if (stringProp(properties, 'content-type', DEFAULTS['content-type']) !== 'image') return false;

  const href = stringProp(properties, 'image-src', DEFAULTS['image-src']).trim();
  if (!href) return false;

  const image = svgEl('image', {
    class: 'side-menu__content-image',
    href,
    x: clamp(numberProp(properties, 'image-x', DEFAULTS['image-x']), -200, 1440),
    y: clamp(numberProp(properties, 'image-y', DEFAULTS['image-y']), -200, 1080),
    width: clamp(numberProp(properties, 'image-width', DEFAULTS['image-width']), 1, 900),
    height: clamp(numberProp(properties, 'image-height', DEFAULTS['image-height']), 1, 900),
    opacity: clamp(numberProp(properties, 'image-opacity', DEFAULTS['image-opacity']), 0, 1),
    preserveAspectRatio: stringProp(properties, 'image-preserve-aspect', 'xMidYMid meet'),
  });
  image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
  svg.appendChild(image);
  return true;
}

function appendRailLabel(svg, properties) {
  if (!booleanProp(properties, 'rail-visible', DEFAULTS['rail-visible'])) return;
  const rawText = stringProp(properties, 'rail-text', DEFAULTS['rail-text']).toUpperCase();
  const x = clamp(numberProp(properties, 'rail-x', DEFAULTS['rail-x']), 0, 1440);
  const y = clamp(numberProp(properties, 'rail-y', DEFAULTS['rail-y']), 0, 1080);
  const rotation = clamp(numberProp(properties, 'rail-rotation', DEFAULTS['rail-rotation']), -180, 180);
  const fontSize = clamp(numberProp(properties, 'rail-font-size', DEFAULTS['rail-font-size']), 12, 80);

  const label = svgEl('text', {
    class: 'side-menu__rail-label',
    x,
    y,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': fontSize,
    transform: `rotate(${rotation} ${x} ${y})`,
  });
  label.textContent = rawText;
  svg.appendChild(label);
}

export default async function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'side-menu';
  const instanceId = ++instanceCounter;
  if (layerId) root.dataset.layerId = layerId;
  const frameVisible = booleanProp(properties, 'frame-visible', DEFAULTS['frame-visible']);
  root.dataset.frameVisible = frameVisible ? 'true' : 'false';
  applyCssProperties(root, properties);

  const stage = document.createElement('div');
  stage.className = 'side-menu__stage';
  const panelLayer = document.createElement('div');
  panelLayer.className = 'side-menu__layer side-menu__panel-layer';
  const frameLayer = document.createElement('div');
  frameLayer.className = 'side-menu__layer side-menu__frame-layer';

  const panelSvg = createSvg('side-menu__panel-svg');
  const frameSvg = createSvg('side-menu__frame-svg');

  let items = DEFAULT_ITEMS;
  try {
    const template = await loadTemplate();
    const panelGroup = document.importNode(template.panel, true);
    appendPanelRain(panelSvg, panelGroup, properties, instanceId);
    panelSvg.appendChild(panelGroup);
    if (frameVisible) frameSvg.appendChild(document.importNode(template.frame, true));
    items = appendImage(panelSvg, properties) ? [] : appendItems(panelSvg, properties);
    appendRailLabel(frameSvg, properties);
  } catch (err) {
    console.warn('[side-menu] failed to load side-menu SVG', err);
  }

  root.setAttribute('aria-label', items.length ? `Side menu: ${items.join(', ')}` : 'Side menu panel');
  panelLayer.appendChild(panelSvg);
  frameLayer.appendChild(frameSvg);
  stage.append(panelLayer, frameLayer);
  root.appendChild(stage);
  queueLabelFit(root);
  return root;
}

// Inspector schema for editor use only. Runtime reads the plain properties.
export const properties = {
  sections: [
    {
      id: 'side-menu-content',
      label: 'Side Menu Content',
      description: 'Text shown on the projected green panel and the gray rail.',
      properties: {
        'item-count': {
          type: 'number',
          label: 'Item Count',
          description: 'Number of panel rows to draw. Uses item fields below, falling back to the pipe list.',
          min: 1,
          max: 6,
          step: 1,
        },
        'item-1': { type: 'string', label: 'Item 1', description: 'First side menu row.' },
        'item-2': { type: 'string', label: 'Item 2', description: 'Second side menu row.' },
        'item-3': { type: 'string', label: 'Item 3', description: 'Third side menu row.' },
        'item-4': { type: 'string', label: 'Item 4', description: 'Fourth side menu row.' },
        'item-5': { type: 'string', label: 'Item 5', description: 'Optional fifth side menu row.' },
        'item-6': { type: 'string', label: 'Item 6', description: 'Optional sixth side menu row.' },
        items: {
          type: 'string',
          label: 'Pipe List',
          description: 'Optional pipe-separated fallback list for the panel rows.',
        },
        'rail-text': {
          type: 'string',
          label: 'Rail Text',
          description: 'Rotated label drawn along the gray indentation.',
        },
      },
    },
    {
      id: 'side-menu-layout',
      label: 'Layout',
      description: 'Flat-stage placement before the per-layer projection transforms are applied.',
      properties: {
        'global-x': {
          type: 'number',
          label: 'X Offset',
          description: 'Horizontal offset in stage pixels applied to the whole side menu.',
          min: -600,
          max: 600,
          step: 1,
        },
        'global-y': {
          type: 'number',
          label: 'Y Offset',
          description: 'Vertical offset in stage pixels applied to the whole side menu.',
          min: -600,
          max: 600,
          step: 1,
        },
        scale: {
          type: 'number',
          label: 'Scale',
          description: 'Uniform scale for the whole side menu.',
          min: 0.25,
          max: 2,
          step: 0.01,
        },
        'content-x': {
          type: 'number',
          label: 'Content X',
          description: 'Left edge of the panel text in viewBox pixels.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'content-y': {
          type: 'number',
          label: 'Content Y',
          description: 'First panel row baseline in viewBox pixels.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'content-width': {
          type: 'number',
          label: 'Text Width',
          description: 'Available width used by auto fit for each panel row.',
          min: 48,
          max: 600,
          step: 1,
        },
        'content-line-height': {
          type: 'number',
          label: 'Line Height',
          description: 'Vertical row spacing in viewBox pixels.',
          min: 24,
          max: 180,
          step: 1,
        },
        'content-font-size': {
          type: 'number',
          label: 'Font Size',
          description: 'Panel row font size before auto fit.',
          min: 12,
          max: 120,
          step: 1,
        },
        'rail-x': {
          type: 'number',
          label: 'Rail X',
          description: 'Horizontal anchor position for the rotated rail label.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'rail-y': {
          type: 'number',
          label: 'Rail Y',
          description: 'Vertical anchor position for the rotated rail label.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'rail-rotation': {
          type: 'number',
          label: 'Rail Rotation',
          description: 'Rotation angle for the rail label. -90 turns the text counterclockwise along the inset.',
          min: -180,
          max: 180,
          step: 1,
        },
        'rail-font-size': {
          type: 'number',
          label: 'Rail Font',
          description: 'Font size for the rotated rail label.',
          min: 12,
          max: 80,
          step: 1,
        },
      },
    },
    {
      id: 'side-menu-projection',
      label: 'Projection',
      description: 'Separate projected-space controls for the green panel and gray frame layers.',
      properties: {
        perspective: {
          type: 'number',
          label: 'Perspective',
          description: 'CSS perspective distance used by both side-menu layers.',
          min: 400,
          max: 4000,
          step: 10,
        },
        'panel-depth': {
          type: 'number',
          label: 'Panel Depth',
          description: 'Z offset for the green panel layer. Negative values push it behind the frame.',
          min: -500,
          max: 500,
          step: 1,
        },
        'frame-depth': {
          type: 'number',
          label: 'Frame Depth',
          description: 'Z offset for the gray frame layer.',
          min: -500,
          max: 500,
          step: 1,
        },
        'panel-rotate-x': {
          type: 'number',
          label: 'Panel Rot X',
          description: '3D X rotation for the green panel layer.',
          min: -65,
          max: 65,
          step: 0.1,
        },
        'panel-rotate-y': {
          type: 'number',
          label: 'Panel Rot Y',
          description: '3D Y rotation for the green panel layer.',
          min: -65,
          max: 65,
          step: 0.1,
        },
        'panel-rotate-z': {
          type: 'number',
          label: 'Panel Rot Z',
          description: '2D Z rotation for the green panel layer.',
          min: -45,
          max: 45,
          step: 0.1,
        },
        'frame-rotate-x': {
          type: 'number',
          label: 'Frame Rot X',
          description: '3D X rotation for the gray frame layer.',
          min: -65,
          max: 65,
          step: 0.1,
        },
        'frame-rotate-y': {
          type: 'number',
          label: 'Frame Rot Y',
          description: '3D Y rotation for the gray frame layer.',
          min: -65,
          max: 65,
          step: 0.1,
        },
        'frame-rotate-z': {
          type: 'number',
          label: 'Frame Rot Z',
          description: '2D Z rotation for the gray frame layer.',
          min: -45,
          max: 45,
          step: 0.1,
        },
        'panel-origin-x': {
          type: 'number',
          label: 'Panel Origin X',
          description: 'Transform-origin X in viewBox pixels for panel projection.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'panel-origin-y': {
          type: 'number',
          label: 'Panel Origin Y',
          description: 'Transform-origin Y in viewBox pixels for panel projection.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'frame-origin-x': {
          type: 'number',
          label: 'Frame Origin X',
          description: 'Transform-origin X in viewBox pixels for frame projection.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'frame-origin-y': {
          type: 'number',
          label: 'Frame Origin Y',
          description: 'Transform-origin Y in viewBox pixels for frame projection.',
          min: 0,
          max: 1080,
          step: 1,
        },
      },
    },
    {
      id: 'side-menu-appearance',
      label: 'Appearance',
      description: 'Color and opacity controls for the panel, frame, and text.',
      sections: [
        {
          id: 'side-menu-surface',
          label: 'Panel',
          properties: {
            'panel-color': { type: 'color', label: 'Fill', description: 'Green panel fill color.' },
            'panel-edge-color': { type: 'color', label: 'Edge', description: 'Green panel rim color.' },
            'panel-opacity': {
              type: 'number',
              label: 'Fill Opacity',
              description: 'Opacity for the green panel fill.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'panel-edge-opacity': {
              type: 'number',
              label: 'Edge Opacity',
              description: 'Opacity for the green panel rim.',
              min: 0,
              max: 1,
              step: 0.01,
            },
          },
        },
        {
          id: 'side-menu-rain',
          label: 'Rain',
          properties: {
            'rain-density': {
              type: 'number',
              label: 'Density',
              description: 'Number of falling pixel streaks clipped inside the panel. Set to 0 to hide the rain.',
              min: 0,
              max: 160,
              step: 1,
            },
            'rain-speed': {
              type: 'number',
              label: 'Speed',
              description: 'Multiplier for the downward pixel rain animation.',
              min: 0.05,
              max: 5,
              step: 0.05,
            },
            'rain-color-offset': {
              type: 'number',
              label: 'White Offset',
              description: 'How far the rain color is mixed from the panel color toward white.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'rain-x-scale': {
              type: 'number',
              label: 'X Scale',
              description: 'Width multiplier for each falling rain pixel or rectangle.',
              min: 0.1,
              max: 8,
              step: 0.05,
            },
            'rain-y-scale': {
              type: 'number',
              label: 'Y Scale',
              description: 'Height multiplier for each falling rain pixel or rectangle.',
              min: 0.1,
              max: 8,
              step: 0.05,
            },
          },
        },
        {
          id: 'side-menu-frame',
          label: 'Frame',
          properties: {
            'frame-visible': {
              type: 'boolean',
              label: 'Gray Frame',
              description: 'Draws the projected gray frame around the side panel.',
            },
            'frame-color': { type: 'color', label: 'Frame', description: 'Primary gray frame line color.' },
            'frame-opacity': {
              type: 'number',
              label: 'Opacity',
              description: 'Opacity for the primary gray frame line.',
              min: 0,
              max: 1,
              step: 0.01,
            },
          },
        },
        {
          id: 'side-menu-text',
          label: 'Text',
          properties: {
            'text-color': { type: 'color', label: 'Text', description: 'Panel item text color.' },
            'text-opacity': {
              type: 'number',
              label: 'Text Opacity',
              description: 'Opacity for the panel item text.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'rail-text-color': { type: 'color', label: 'Rail Text', description: 'Rotated rail label color.' },
            'rail-visible': {
              type: 'boolean',
              label: 'Rail Visible',
              description: 'Show the rotated rail label.',
            },
            'rail-text-opacity': {
              type: 'number',
              label: 'Rail Opacity',
              description: 'Opacity for the rotated rail label.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'text-auto-fit': {
              type: 'boolean',
              label: 'Auto Fit',
              description: 'Shrinks panel rows independently when labels are wider than the available text width.',
            },
            'text-min-font-size': {
              type: 'number',
              label: 'Min Font',
              description: 'Smallest panel row font size auto fit can use.',
              min: 8,
              max: 120,
              step: 1,
            },
            'text-max-font-size': {
              type: 'number',
              label: 'Max Font',
              description: 'Largest panel row font size auto fit can use.',
              min: 8,
              max: 140,
              step: 1,
            },
          },
        },
      ],
    },
  ],
};
