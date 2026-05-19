const SVG_NS = 'http://www.w3.org/2000/svg';
const TEMPLATE_URL = '/modules/components/side-menu/side-menu.svg';

let templatePromise = null;

const DEFAULT_ITEMS = ['Regular Match', 'Event Match', 'Stadium', 'Training'];

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
  'frame-color': '#b8bbc2',
  'frame-opacity': 0.78,
  'text-color': '#dce0ee',
  'text-shadow-color': 'rgba(0, 0, 0, 0.6)',
  'rail-text': 'START PAUSE',
  'rail-text-color': '#aaaeb6',
  'rail-x': 884,
  'rail-y': 565,
  'rail-rotation': -90,
  'rail-font-size': 29,
  'content-x': 1027,
  'content-y': 414,
  'content-width': 240,
  'content-line-height': 70,
  'content-font-size': 43,
  'text-auto-fit': true,
  'text-min-font-size': 28,
  'text-max-font-size': 54,
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
  const fromList = stringProp(properties, 'items', DEFAULTS.items)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
  const count = clamp(
    Math.round(numberProp(properties, 'item-count', fromList.length || DEFAULTS['item-count'])),
    1,
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
    '--side-menu-text-shadow',
    stringProp(properties, 'text-shadow-color', DEFAULTS['text-shadow-color']),
  );
  root.style.setProperty('--side-menu-rail-text', stringProp(properties, 'rail-text-color', DEFAULTS['rail-text-color']));
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

function appendItems(svg, properties) {
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

function appendRailLabel(svg, properties) {
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
  if (layerId) root.dataset.layerId = layerId;
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
    panelSvg.appendChild(document.importNode(template.panel, true));
    frameSvg.appendChild(document.importNode(template.frame, true));
    items = appendItems(panelSvg, properties);
    appendRailLabel(frameSvg, properties);
  } catch (err) {
    console.warn('[side-menu] failed to load side-menu SVG', err);
  }

  root.setAttribute('aria-label', `Side menu: ${items.join(', ')}`);
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
      properties: {
        'panel-color': { type: 'color', label: 'Panel', description: 'Green panel fill color.' },
        'panel-edge-color': { type: 'color', label: 'Panel Edge', description: 'Green panel rim color.' },
        'panel-opacity': {
          type: 'number',
          label: 'Panel Opacity',
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
        'frame-color': { type: 'color', label: 'Frame', description: 'Primary gray frame line color.' },
        'frame-opacity': {
          type: 'number',
          label: 'Frame Opacity',
          description: 'Opacity for the primary gray frame line.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'text-color': { type: 'color', label: 'Text', description: 'Panel item text color.' },
        'rail-text-color': { type: 'color', label: 'Rail Text', description: 'Rotated rail label color.' },
        'text-auto-fit': {
          type: 'boolean',
          label: 'Auto Text Fit',
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
};
