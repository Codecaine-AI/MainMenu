const SVG_NS = 'http://www.w3.org/2000/svg';
const ITEM_SVG_URL = '/modules/components/menu-items/menu-item.svg';
const ITEM_VIEWBOX_WIDTH = 760;
const ITEM_VIEWBOX_HEIGHT = 128;

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
  'font-scale': 1,
  'gold-color': '#d5a02a',
  'hot-gold-color': '#ffd31d',
  'panel-color': '#050505',
  'selected-text-color': '#050505',
  'unselected-text-color': '#d8a33a',
  'marker-opacity': 0.82,
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

function rowLayout(properties, index, offsetX, offsetY, scale) {
  const base = DEFAULT_ROW_LAYOUT[index];
  const row = index + 1;
  const x = numberProp(properties, `row-${row}-x`, base.x);
  const y = numberProp(properties, `row-${row}-y`, base.y);
  const width = numberProp(properties, `row-${row}-width`, base.width);
  const height = numberProp(properties, `row-${row}-height`, base.height);
  return {
    x: offsetX + x * scale,
    y: offsetY + y * scale,
    width: width * scale,
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

function appendRow(svg, template, label, index, layout, selectedIndex, fontScale) {
  const rowIndex = index + 1;
  const row = svgEl('g', {
    class: rowIndex === selectedIndex ? 'menu-items__row is-selected' : 'menu-items__row',
    role: 'button',
    tabindex: '0',
    'aria-label': label,
    'aria-pressed': rowIndex === selectedIndex ? 'true' : 'false',
  });
  row.dataset.menuIndex = String(rowIndex);

  const geometry = svgEl('g', {
    class: 'menu-items__geometry',
    transform: [
      `translate(${layout.x.toFixed(3)} ${layout.y.toFixed(3)})`,
      `scale(${(layout.width / ITEM_VIEWBOX_WIDTH).toFixed(5)} ${(layout.height / ITEM_VIEWBOX_HEIGHT).toFixed(5)})`,
    ].join(' '),
  });
  geometry.appendChild(document.importNode(template.asset, true));
  row.appendChild(geometry);

  const text = svgEl('text', {
    class: 'menu-items__label',
    x: (layout.x + layout.width * layout.textX).toFixed(3),
    y: (layout.y + layout.height * 0.54).toFixed(3),
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': clamp(layout.fontSize * fontScale, 24, 120).toFixed(3),
  });
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
  root.style.setProperty('--menu-items-gold', stringProp(properties, 'gold-color', DEFAULTS['gold-color']));
  root.style.setProperty('--menu-items-hot-gold', stringProp(properties, 'hot-gold-color', DEFAULTS['hot-gold-color']));
  root.style.setProperty('--menu-items-panel', stringProp(properties, 'panel-color', DEFAULTS['panel-color']));
  root.style.setProperty('--menu-items-selected-text', stringProp(properties, 'selected-text-color', DEFAULTS['selected-text-color']));
  root.style.setProperty('--menu-items-unselected-text', stringProp(properties, 'unselected-text-color', DEFAULTS['unselected-text-color']));
  root.style.setProperty(
    '--menu-items-marker-opacity',
    String(clamp(numberProp(properties, 'marker-opacity', DEFAULTS['marker-opacity']), 0, 1)),
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
  const fontScale = clamp(numberProp(properties, 'font-scale', DEFAULTS['font-scale']), 0.4, 1.8);

  try {
    const template = await loadItemTemplate();
    if (template.defs) svg.appendChild(document.importNode(template.defs, true));
    items.forEach((item, index) => {
      appendRow(svg, template, item, index, rowLayout(properties, index, offsetX, offsetY, scale), selectedIndex, fontScale);
    });
  } catch (err) {
    console.warn('[menu-items] failed to load item SVG', err);
  }

  root.appendChild(svg);
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
        'font-scale': {
          type: 'number',
          label: 'Font Scale',
          description: 'Additional multiplier for row label sizes.',
          min: 0.4,
          max: 1.8,
          step: 0.01,
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
    },
  ],
};
