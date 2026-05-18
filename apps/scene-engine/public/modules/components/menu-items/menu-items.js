const SVG_NS = 'http://www.w3.org/2000/svg';
const ITEM_SVG_URL = '/modules/components/menu-items/menu-item.svg';
const ITEM_VIEWBOX_WIDTH = 760;
const ITEM_VIEWBOX_HEIGHT = 128;
const ITEM_LEFT_SLICE_END = 90;
const ITEM_RIGHT_SLICE_START = 626;
const ITEM_SLICE_OVERLAP = 2;

let itemTemplatePromise = null;

const DEFAULT_ITEMS = ['1-P Mode', 'VS. Mode', 'Trophies', 'Options', 'Data'];

const DEFAULT_ROW_LAYOUT = [
  { x: 326, y: 274, width: 812, height: 126, textX: 0.48, fontSize: 70 },
  { x: 210, y: 389, width: 780, height: 116, textX: 0.49, fontSize: 76 },
  { x: 98, y: 508, width: 728, height: 116, textX: 0.52, fontSize: 74 },
  { x: 154, y: 629, width: 770, height: 116, textX: 0.51, fontSize: 72 },
  { x: 116, y: 750, width: 728, height: 116, textX: 0.5, fontSize: 72 },
];

const DEFAULTS = {
  items: DEFAULT_ITEMS.join('|'),
  'selected-index': 1,
  'marker-visible': true,
  'x-offset': 0,
  'y-offset': 0,
  scale: 1,
  'width-scale': 1,
  'font-scale': 1,
  'text-auto-fit': true,
  'text-min-font-size': 42,
  'text-max-font-size': 84,
  'text-fit-padding': 18,
  'gold-color': '#d5a02a',
  'hot-gold-color': '#fdc903',
  'panel-color': '#050505',
  'selected-text-color': '#050505',
  'unselected-text-color': '#d8a33a',
  'marker-opacity': 1,
  'marker-pulse-opacity': 1,
  'marker-pulse-edge-opacity': 0.2,
  'marker-pulse-color': '#e0e0d6',
  'marker-pulse-thickness': 4,
  'marker-pulse-feather-width': 18,
  'marker-pulse-radius': 2.1,
  'marker-pulse-contract-speed': 2.4,
  'marker-pulse-cooldown': 1.2,
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

function pulseTiming(properties) {
  const contractSpeed = clamp(
    numberProp(
      properties,
      'marker-pulse-contract-speed',
      numberProp(properties, 'marker-pulse-interval', DEFAULTS['marker-pulse-contract-speed']),
    ),
    0.4,
    8,
  );
  const cooldown = clamp(numberProp(properties, 'marker-pulse-cooldown', DEFAULTS['marker-pulse-cooldown']), 0, 12);

  return {
    contractSpeed,
    cooldown,
    cycle: contractSpeed + cooldown,
  };
}

function animationName(layerId) {
  const suffix = String(layerId || 'default')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';

  return `menu-item-marker-collapse-${suffix}`;
}

function appendPulseTimingStyle(root, properties, layerId) {
  const { contractSpeed, cycle } = pulseTiming(properties);
  const name = animationName(layerId);
  const activeEnd = clamp((contractSpeed / cycle) * 100, 1, 100);
  const fadeInEnd = activeEnd * 0.22;
  const contractEnd = activeEnd * 0.75;
  const precision = (value) => Number(value.toFixed(4));

  root.style.setProperty('--menu-items-marker-pulse-animation-name', name);

  const style = document.createElement('style');
  style.textContent = `
@keyframes ${name} {
  0% {
    opacity: 0;
    transform: scale(var(--menu-items-marker-pulse-radius));
  }

  ${precision(fadeInEnd)}% {
    opacity: 1;
    transform: scale(var(--menu-items-marker-pulse-radius));
  }

  ${precision(contractEnd)}% {
    opacity: 1;
    transform: scale(0.8);
  }

  ${precision(activeEnd)}% {
    opacity: 0;
    transform: scale(0.68);
  }

  100% {
    opacity: 0;
    transform: scale(0.68);
  }
}
`;
  root.appendChild(style);
}

function parseItems(properties) {
  const fromList = stringProp(properties, 'items', DEFAULTS.items)
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

  const items = DEFAULT_ITEMS.map((fallback, index) => {
    const key = `item-${index + 1}`;
    return stringProp(properties, key, fromList[index] ?? fallback);
  });

  return items;
}

function textFitSettings(properties) {
  const minFontSize = clamp(numberProp(properties, 'text-min-font-size', DEFAULTS['text-min-font-size']), 18, 140);
  const maxFontSize = clamp(
    numberProp(properties, 'text-max-font-size', DEFAULTS['text-max-font-size']),
    minFontSize,
    160,
  );

  return {
    enabled: booleanProp(properties, 'text-auto-fit', DEFAULTS['text-auto-fit']),
    minFontSize,
    maxFontSize,
    padding: clamp(numberProp(properties, 'text-fit-padding', DEFAULTS['text-fit-padding']), 0, 120),
  };
}

function estimateTextLength(text, fontSize) {
  const weightedLength = Array.from(text).reduce((total, char) => {
    if (char === ' ') return total + 0.32;
    if (char === '-' || char === '.') return total + 0.3;
    if (/[1Iijl]/.test(char)) return total + 0.36;
    if (/[MW]/.test(char)) return total + 0.9;
    if (/[A-Z]/.test(char)) return total + 0.68;
    return total + 0.56;
  }, 0);

  return weightedLength * fontSize;
}

function fitLabelText(label) {
  if (label.dataset.menuFitEnabled !== 'true') return;

  const availableWidth = Number(label.dataset.menuFitWidth);
  const baseFontSize = Number(label.dataset.menuFitBase);
  const minFontSize = Number(label.dataset.menuFitMin);
  const maxFontSize = Number(label.dataset.menuFitMax);
  if (![availableWidth, baseFontSize, minFontSize, maxFontSize].every(Number.isFinite)) return;

  const targetFontSize = clamp(baseFontSize, minFontSize, maxFontSize);
  label.setAttribute('font-size', targetFontSize.toFixed(3));

  let measuredWidth = estimateTextLength(label.textContent || '', targetFontSize);
  if (typeof label.getComputedTextLength === 'function') {
    try {
      const renderedWidth = label.getComputedTextLength();
      if (Number.isFinite(renderedWidth) && renderedWidth > 0) measuredWidth = renderedWidth;
    } catch {
      // Detached SVG nodes can fail measurement before the scene mounts.
    }
  }
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0 || measuredWidth <= availableWidth) return;

  const fittedFontSize = clamp(targetFontSize * (availableWidth / measuredWidth), minFontSize, targetFontSize);
  label.setAttribute('font-size', fittedFontSize.toFixed(3));
}

function fitLabels(root) {
  root.querySelectorAll('.menu-items__label').forEach(fitLabelText);
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

async function loadItemTemplate() {
  if (!itemTemplatePromise) {
    itemTemplatePromise = fetch(ITEM_SVG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${ITEM_SVG_URL}: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) throw new Error(`Invalid SVG in ${ITEM_SVG_URL}`);
        const asset = doc.querySelector('.menu-item__asset');
        if (!asset) throw new Error(`Missing .menu-item__asset in ${ITEM_SVG_URL}`);
        return {
          defs: doc.querySelector('defs'),
          asset,
        };
      })
      .catch((err) => {
        itemTemplatePromise = null;
        throw err;
      });
  }

  return itemTemplatePromise;
}

function rowLayout(properties, index, offsetX, offsetY, scale, widthScale) {
  const base = DEFAULT_ROW_LAYOUT[index];
  const row = index + 1;
  const x = numberProp(properties, `row-${row}-x`, base.x);
  const y = numberProp(properties, `row-${row}-y`, base.y);
  const width = numberProp(properties, `row-${row}-width`, base.width);
  const height = numberProp(properties, `row-${row}-height`, base.height);
  return {
    x: offsetX + x * scale,
    y: offsetY + y * scale,
    width: width * widthScale * scale,
    height: height * scale,
    textX: clamp(numberProp(properties, `row-${row}-text-x`, base.textX), 0.2, 0.8),
    fontSize: numberProp(properties, `row-${row}-font-size`, base.fontSize) * scale,
  };
}

function setSelected(svg, selectedIndex) {
  const rows = svg.querySelectorAll('.menu-items__row');
  for (const row of rows) {
    const index = Number(row.dataset.menuIndex);
    row.classList.toggle('is-selected', index === selectedIndex);
    row.setAttribute('aria-pressed', index === selectedIndex ? 'true' : 'false');
  }
}

function appendGeometrySlice(parent, template, x, width, viewBoxX, viewBoxWidth) {
  const slice = svgEl('svg', {
    class: 'menu-items__geometry-slice',
    x: x.toFixed(3),
    y: 0,
    width: width.toFixed(3),
    height: ITEM_VIEWBOX_HEIGHT,
    viewBox: `${viewBoxX} 0 ${viewBoxWidth} ${ITEM_VIEWBOX_HEIGHT}`,
    preserveAspectRatio: 'none',
    overflow: 'hidden',
  });

  slice.appendChild(document.importNode(template.asset, true));
  parent.appendChild(slice);
}

function appendMarker(parent, template, markerX) {
  const markerAsset = document.importNode(template.asset, true);
  const marker = markerAsset.querySelector('.menu-item__marker');
  if (!marker) return;

  marker.setAttribute('transform', `translate(${markerX.toFixed(3)} 64)`);
  parent.appendChild(marker);
}

function appendRow(svg, template, label, index, layout, selectedIndex, fontScale, fitSettings) {
  const rowIndex = index + 1;
  const row = svgEl('g', {
    class: rowIndex === selectedIndex ? 'menu-items__row is-selected' : 'menu-items__row',
    role: 'button',
    tabindex: '0',
    'aria-label': label,
    'aria-pressed': rowIndex === selectedIndex ? 'true' : 'false',
  });
  row.dataset.menuIndex = String(rowIndex);

  const yScale = layout.height / ITEM_VIEWBOX_HEIGHT;
  const leftWidth = ITEM_LEFT_SLICE_END;
  const rightWidth = ITEM_VIEWBOX_WIDTH - ITEM_RIGHT_SLICE_START;
  const baseMiddleWidth = ITEM_RIGHT_SLICE_START - ITEM_LEFT_SLICE_END;
  const targetSourceWidth = layout.width / yScale;
  const middleWidth = Math.max(8, targetSourceWidth - leftWidth - rightWidth);

  const geometry = svgEl('g', {
    class: 'menu-items__geometry',
    transform: [
      `translate(${layout.x.toFixed(3)} ${layout.y.toFixed(3)})`,
      `scale(${yScale.toFixed(5)})`,
    ].join(' '),
  });
  const shell = svgEl('g', { class: 'menu-items__item-shell' });
  appendGeometrySlice(
    shell,
    template,
    leftWidth - ITEM_SLICE_OVERLAP,
    middleWidth + ITEM_SLICE_OVERLAP * 2,
    ITEM_LEFT_SLICE_END - ITEM_SLICE_OVERLAP,
    baseMiddleWidth + ITEM_SLICE_OVERLAP * 2,
  );
  appendGeometrySlice(shell, template, 0, leftWidth + ITEM_SLICE_OVERLAP, 0, leftWidth + ITEM_SLICE_OVERLAP);
  appendGeometrySlice(
    shell,
    template,
    leftWidth + middleWidth - ITEM_SLICE_OVERLAP,
    rightWidth + ITEM_SLICE_OVERLAP,
    ITEM_RIGHT_SLICE_START - ITEM_SLICE_OVERLAP,
    rightWidth + ITEM_SLICE_OVERLAP,
  );
  geometry.appendChild(shell);
  appendMarker(geometry, template, leftWidth + middleWidth + (683 - ITEM_RIGHT_SLICE_START));
  row.appendChild(geometry);

  const textCenter = layout.x + layout.width * layout.textX;
  const textLeftBound = layout.x + (ITEM_LEFT_SLICE_END * yScale) + fitSettings.padding;
  const textRightBound = layout.x + ((leftWidth + middleWidth) * yScale) - fitSettings.padding;
  const fitWidth = Math.max(24, Math.min(textCenter - textLeftBound, textRightBound - textCenter) * 2);
  const baseFontSize = layout.fontSize * fontScale;
  const fontSize = fitSettings.enabled
    ? clamp(baseFontSize, fitSettings.minFontSize, fitSettings.maxFontSize)
    : clamp(baseFontSize, 24, 120);

  const text = svgEl('text', {
    class: 'menu-items__label',
    x: textCenter.toFixed(3),
    y: (layout.y + layout.height * 0.54).toFixed(3),
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': fontSize.toFixed(3),
  });
  text.dataset.menuFitEnabled = fitSettings.enabled ? 'true' : 'false';
  text.dataset.menuFitWidth = String(fitWidth);
  text.dataset.menuFitBase = String(baseFontSize);
  text.dataset.menuFitMin = String(fitSettings.minFontSize);
  text.dataset.menuFitMax = String(fitSettings.maxFontSize);
  text.textContent = label;
  row.appendChild(text);

  row.addEventListener('click', () => setSelected(svg, rowIndex));
  row.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setSelected(svg, rowIndex);
  });

  svg.appendChild(row);
}

function applyCssProperties(root, properties) {
  const pulse = pulseTiming(properties);
  const pulseThickness = clamp(numberProp(properties, 'marker-pulse-thickness', DEFAULTS['marker-pulse-thickness']), 1, 24);
  const pulseFeatherWidth = clamp(
    numberProp(properties, 'marker-pulse-feather-width', DEFAULTS['marker-pulse-feather-width']),
    pulseThickness,
    80,
  );

  root.style.setProperty('--menu-items-gold', stringProp(properties, 'gold-color', DEFAULTS['gold-color']));
  root.style.setProperty('--menu-items-hot-gold', stringProp(properties, 'hot-gold-color', DEFAULTS['hot-gold-color']));
  root.style.setProperty('--menu-items-panel', stringProp(properties, 'panel-color', DEFAULTS['panel-color']));
  root.style.setProperty('--menu-items-selected-text', stringProp(properties, 'selected-text-color', DEFAULTS['selected-text-color']));
  root.style.setProperty('--menu-items-unselected-text', stringProp(properties, 'unselected-text-color', DEFAULTS['unselected-text-color']));
  root.style.setProperty(
    '--menu-items-marker-opacity',
    String(clamp(numberProp(properties, 'marker-opacity', DEFAULTS['marker-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-opacity',
    String(clamp(numberProp(properties, 'marker-pulse-opacity', DEFAULTS['marker-pulse-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-edge-opacity',
    String(clamp(numberProp(properties, 'marker-pulse-edge-opacity', DEFAULTS['marker-pulse-edge-opacity']), 0, 1)),
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-color',
    stringProp(properties, 'marker-pulse-color', DEFAULTS['marker-pulse-color']),
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-thickness',
    `${pulseThickness}px`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-feather-width',
    `${pulseFeatherWidth}px`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-feather-blur',
    `${Math.max(0, (pulseFeatherWidth - pulseThickness) * 0.35)}px`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-core-blur',
    `${Math.max(0.45, pulseThickness * 0.35)}px`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-radius',
    String(clamp(numberProp(properties, 'marker-pulse-radius', DEFAULTS['marker-pulse-radius']), 1, 4)),
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-contract-speed',
    `${pulse.contractSpeed}s`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-cooldown',
    `${pulse.cooldown}s`,
  );
  root.style.setProperty(
    '--menu-items-marker-pulse-cycle',
    `${pulse.cycle}s`,
  );
}

export default async function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'menu-items';
  if (booleanProp(properties, 'marker-visible', DEFAULTS['marker-visible'])) {
    root.classList.add('has-marker');
  }
  if (layerId) root.dataset.layerId = layerId;
  applyCssProperties(root, properties);
  appendPulseTimingStyle(root, properties, layerId);

  const items = parseItems(properties);
  root.setAttribute('aria-label', `Main menu items: ${items.join(', ')}`);

  const svg = svgEl('svg', {
    class: 'menu-items__svg',
    viewBox: '0 0 1440 1080',
    preserveAspectRatio: 'xMidYMid meet',
    role: 'group',
  });

  const selectedIndex = clamp(Math.round(numberProp(properties, 'selected-index', DEFAULTS['selected-index'])), 1, items.length);
  const offsetX = numberProp(properties, 'x-offset', DEFAULTS['x-offset']);
  const offsetY = numberProp(properties, 'y-offset', DEFAULTS['y-offset']);
  const scale = clamp(numberProp(properties, 'scale', DEFAULTS.scale), 0.25, 2);
  const widthScale = clamp(numberProp(properties, 'width-scale', DEFAULTS['width-scale']), 0.4, 1.4);
  const fontScale = clamp(numberProp(properties, 'font-scale', DEFAULTS['font-scale']), 0.4, 1.8);
  const fitSettings = textFitSettings(properties);

  try {
    const template = await loadItemTemplate();
    if (template.defs) svg.appendChild(document.importNode(template.defs, true));
    items.forEach((item, index) => {
      appendRow(
        svg,
        template,
        item,
        index,
        rowLayout(properties, index, offsetX, offsetY, scale, widthScale),
        selectedIndex,
        fontScale,
        fitSettings,
      );
    });
  } catch (err) {
    console.warn('[menu-items] failed to load item SVG', err);
  }

  root.appendChild(svg);
  queueLabelFit(root);
  return root;
}

// Inspector schema for editor use only. Runtime reads the plain properties.
export const properties = {
  sections: [
    {
      id: 'menu-items-content',
      label: 'Menu Items',
      description: 'Text and selected row for the main menu stack.',
      properties: {
        'selected-index': {
          type: 'number',
          label: 'Selected Index',
          description: 'The row shown as the active solid yellow item. Uses 1-5.',
          min: 1,
          max: 5,
          step: 1,
        },
        'item-1': {
          type: 'string',
          label: 'Item 1',
          description: 'Text for the first row.',
        },
        'item-2': {
          type: 'string',
          label: 'Item 2',
          description: 'Text for the second row.',
        },
        'item-3': {
          type: 'string',
          label: 'Item 3',
          description: 'Text for the third row.',
        },
        'item-4': {
          type: 'string',
          label: 'Item 4',
          description: 'Text for the fourth row.',
        },
        'item-5': {
          type: 'string',
          label: 'Item 5',
          description: 'Text for the fifth row.',
        },
        items: {
          type: 'string',
          label: 'Pipe List',
          description: 'Optional pipe-separated item list. Individual row text fields override this list.',
        },
      },
    },
    {
      id: 'menu-items-layout',
      label: 'Layout',
      description: 'Global placement controls for the five-row stack.',
      properties: {
        'x-offset': {
          type: 'number',
          label: 'X Offset',
          description: 'Horizontal offset in stage pixels applied to every row.',
          min: -400,
          max: 400,
          step: 1,
        },
        'y-offset': {
          type: 'number',
          label: 'Y Offset',
          description: 'Vertical offset in stage pixels applied to every row.',
          min: -400,
          max: 400,
          step: 1,
        },
        scale: {
          type: 'number',
          label: 'Scale',
          description: 'Uniform scale for the row geometry and default text sizes.',
          min: 0.25,
          max: 2,
          step: 0.01,
        },
        'width-scale': {
          type: 'number',
          label: 'Width Scale',
          description: 'Horizontal multiplier for every menu item. A value of 0.75 makes rows 25% narrower.',
          min: 0.4,
          max: 1.4,
          step: 0.01,
        },
        'font-scale': {
          type: 'number',
          label: 'Font Scale',
          description: 'Additional multiplier for row label sizes before auto fitting.',
          min: 0.4,
          max: 1.8,
          step: 0.01,
        },
        'text-auto-fit': {
          type: 'boolean',
          label: 'Auto Text Fit',
          description: 'Shrinks each label independently so longer option names fit inside the item.',
        },
        'text-min-font-size': {
          type: 'number',
          label: 'Min Font Size',
          description: 'Smallest label size auto fit can use.',
          min: 18,
          max: 140,
          step: 1,
        },
        'text-max-font-size': {
          type: 'number',
          label: 'Max Font Size',
          description: 'Largest label size auto fit can use.',
          min: 18,
          max: 160,
          step: 1,
        },
        'text-fit-padding': {
          type: 'number',
          label: 'Text Padding',
          description: 'Horizontal padding kept between fitted text and the item caps.',
          min: 0,
          max: 120,
          step: 1,
        },
      },
    },
    {
      id: 'menu-items-appearance',
      label: 'Appearance',
      description: 'Colors and target marker visibility for the menu items.',
      properties: {
        'gold-color': {
          type: 'color',
          label: 'Gold',
          description: 'Primary gold used for unselected outlines and labels.',
        },
        'hot-gold-color': {
          type: 'color',
          label: 'Hot Gold',
          description: 'Solid fill and glow color used by the selected row.',
        },
        'panel-color': {
          type: 'color',
          label: 'Panel',
          description: 'Black interior and P cutout color.',
        },
        'selected-text-color': {
          type: 'color',
          label: 'Selected Text',
          description: 'Text color for the active solid row.',
        },
        'unselected-text-color': {
          type: 'color',
          label: 'Unselected Text',
          description: 'Text color for inactive outline rows.',
        },
        'marker-visible': {
          type: 'boolean',
          label: 'Target Marker',
          description: 'Shows the circular target marker on the active row.',
        },
        'marker-opacity': {
          type: 'number',
          label: 'Marker Opacity',
          description: 'Opacity for the active row target marker.',
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
      sections: [
        {
          id: 'menu-items-marker-pulse',
          label: 'Pulse',
          description: 'Animated ring that contracts into the selected target marker.',
          properties: {
            'marker-pulse-opacity': {
              type: 'number',
              label: 'Pulsing Opacity',
              description: 'Opacity of the pulse ring core at peak visibility.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'marker-pulse-edge-opacity': {
              type: 'number',
              label: 'Pulse Edge Opacity',
              description: 'Opacity of the soft outer feather around the pulse ring.',
              min: 0,
              max: 1,
              step: 0.01,
            },
            'marker-pulse-color': {
              type: 'color',
              label: 'Pulse Color',
              description: 'Color of the contracting pulse ring.',
            },
            'marker-pulse-thickness': {
              type: 'number',
              label: 'Pulse Thickness',
              description: 'Base width in SVG pixels for the brightest part of the blended pulse ring.',
              min: 1,
              max: 24,
              step: 0.5,
            },
            'marker-pulse-feather-width': {
              type: 'number',
              label: 'Pulse Feather Width',
              description: 'Total width in SVG pixels for the soft outer falloff around the pulse ring.',
              min: 1,
              max: 80,
              step: 1,
            },
            'marker-pulse-radius': {
              type: 'number',
              label: 'Pulse Radius',
              description: 'Starting radius multiplier for the contracting pulse ring.',
              min: 1,
              max: 4,
              step: 0.05,
            },
            'marker-pulse-contract-speed': {
              type: 'number',
              label: 'Contract Speed',
              description: 'Seconds the pulse spends contracting into the target before cooldown.',
              min: 0.4,
              max: 8,
              step: 0.1,
            },
            'marker-pulse-cooldown': {
              type: 'number',
              label: 'Cooldown',
              description: 'Seconds to wait after each pulse before the next ring starts.',
              min: 0,
              max: 12,
              step: 0.1,
            },
          },
        },
      ],
    },
  ],
};
