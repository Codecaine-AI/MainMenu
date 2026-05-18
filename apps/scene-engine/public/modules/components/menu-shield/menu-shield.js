const SVG_NS = 'http://www.w3.org/2000/svg';
const FRAME_SVG_URL = '/modules/components/menu-shield/menu-shield-frame.svg';

let frameTemplatePromise = null;

const DEFAULTS = {
  'top-text': 'Main Menu',
  'bottom-text': 'Solo Smash!',
  'border-color': '#3158e8',
  'border-opacity': 0.96,
  'fill-opacity': 0.3,
  'top-text-color': '#a7a9b7',
  'bottom-text-color': '#e4e7ff',
  'button-border-color': '#eef1ff',
  'button-fill-color': '#03040a',
  'top-x': 232,
  'top-y': 136,
  'top-font-size': 64,
  'bottom-x': 725,
  'bottom-y': 944,
  'bottom-font-size': 56,
  'button-x': 344,
  'button-y': 902,
  'button-width': 762,
  'button-height': 84,
  'button-radius': 11,
  'button-border-width': 7,
};

function numberProp(properties, key, fallback) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function appendText(parent, className, text, x, y, anchor = 'middle') {
  const node = svgEl('text', {
    class: className,
    x,
    y,
    'text-anchor': anchor,
    'dominant-baseline': 'middle',
  });
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

async function loadFrameTemplate() {
  if (!frameTemplatePromise) {
    frameTemplatePromise = fetch(FRAME_SVG_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${FRAME_SVG_URL}: ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const parserError = doc.querySelector('parsererror');
        if (parserError) throw new Error(`Invalid SVG in ${FRAME_SVG_URL}`);
        const frame = doc.querySelector('.menu-shield__frame');
        if (!frame) throw new Error(`Missing .menu-shield__frame in ${FRAME_SVG_URL}`);
        return frame;
      })
      .catch((err) => {
        frameTemplatePromise = null;
        throw err;
      });
  }

  return frameTemplatePromise;
}

async function appendFrame(svg) {
  try {
    const frame = await loadFrameTemplate();
    svg.appendChild(document.importNode(frame, true));
  } catch (err) {
    console.warn('[menu-shield] failed to load frame SVG', err);
    svg.appendChild(svgEl('g', { class: 'menu-shield__frame' }));
  }
}

export default async function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'menu-shield';
  root.setAttribute(
    'aria-label',
    `${stringProp(properties, 'top-text', DEFAULTS['top-text'])}: ${stringProp(properties, 'bottom-text', DEFAULTS['bottom-text'])}`,
  );
  if (layerId) root.dataset.layerId = layerId;

  const borderOpacity = clamp(numberProp(properties, 'border-opacity', DEFAULTS['border-opacity']), 0, 1);
  const fillOpacity = clamp(numberProp(properties, 'fill-opacity', DEFAULTS['fill-opacity']), 0, 1);
  root.style.setProperty('--menu-shield-border', stringProp(properties, 'border-color', DEFAULTS['border-color']));
  root.style.setProperty('--menu-shield-border-opacity', String(borderOpacity));
  root.style.setProperty('--menu-shield-glow-opacity', String(borderOpacity * 0.28));
  root.style.setProperty('--menu-shield-inner-opacity', String(borderOpacity * 0.88));
  root.style.setProperty('--menu-shield-rib-opacity', String(borderOpacity * 0.92));
  root.style.setProperty('--menu-shield-break-opacity', String(borderOpacity * 0.72));
  root.style.setProperty('--menu-shield-fill-opacity', String(fillOpacity));
  root.style.setProperty('--menu-shield-top-text', stringProp(properties, 'top-text-color', DEFAULTS['top-text-color']));
  root.style.setProperty('--menu-shield-bottom-text', stringProp(properties, 'bottom-text-color', DEFAULTS['bottom-text-color']));
  root.style.setProperty('--menu-shield-button-border', stringProp(properties, 'button-border-color', DEFAULTS['button-border-color']));
  root.style.setProperty('--menu-shield-button-fill', stringProp(properties, 'button-fill-color', DEFAULTS['button-fill-color']));
  root.style.setProperty('--menu-shield-top-font-size', `${clamp(numberProp(properties, 'top-font-size', DEFAULTS['top-font-size']), 24, 120)}px`);
  root.style.setProperty('--menu-shield-bottom-font-size', `${clamp(numberProp(properties, 'bottom-font-size', DEFAULTS['bottom-font-size']), 24, 120)}px`);

  const svg = svgEl('svg', {
    class: 'menu-shield__svg',
    viewBox: '0 0 1440 1080',
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });

  await appendFrame(svg);

  const buttonX = clamp(numberProp(properties, 'button-x', DEFAULTS['button-x']), 0, 1440);
  const buttonY = clamp(numberProp(properties, 'button-y', DEFAULTS['button-y']), 0, 1080);
  const buttonWidth = clamp(numberProp(properties, 'button-width', DEFAULTS['button-width']), 80, 1440);
  const buttonHeight = clamp(numberProp(properties, 'button-height', DEFAULTS['button-height']), 30, 260);
  const buttonRadius = clamp(numberProp(properties, 'button-radius', DEFAULTS['button-radius']), 0, 48);
  const buttonBorderWidth = clamp(numberProp(properties, 'button-border-width', DEFAULTS['button-border-width']), 1, 24);
  const button = svgEl('g', { class: 'menu-shield__button' });
  button.appendChild(svgEl('rect', {
    class: 'menu-shield__button-shadow',
    x: buttonX,
    y: buttonY + 5,
    width: buttonWidth,
    height: buttonHeight,
    rx: buttonRadius,
    ry: buttonRadius,
  }));
  button.appendChild(svgEl('rect', {
    class: 'menu-shield__button-frame',
    x: buttonX,
    y: buttonY,
    width: buttonWidth,
    height: buttonHeight,
    rx: buttonRadius,
    ry: buttonRadius,
    'stroke-width': buttonBorderWidth,
  }));
  button.appendChild(svgEl('rect', {
    class: 'menu-shield__button-inner-line',
    x: buttonX + buttonBorderWidth,
    y: buttonY + buttonBorderWidth,
    width: Math.max(0, buttonWidth - buttonBorderWidth * 2),
    height: Math.max(0, buttonHeight - buttonBorderWidth * 2),
    rx: Math.max(0, buttonRadius - buttonBorderWidth * 0.5),
    ry: Math.max(0, buttonRadius - buttonBorderWidth * 0.5),
  }));
  svg.appendChild(button);

  appendText(
    svg,
    'menu-shield__top-text',
    stringProp(properties, 'top-text', DEFAULTS['top-text']),
    clamp(numberProp(properties, 'top-x', DEFAULTS['top-x']), 0, 1440),
    clamp(numberProp(properties, 'top-y', DEFAULTS['top-y']), 0, 1080),
    'start',
  );
  appendText(
    svg,
    'menu-shield__bottom-text',
    stringProp(properties, 'bottom-text', DEFAULTS['bottom-text']),
    clamp(numberProp(properties, 'bottom-x', DEFAULTS['bottom-x']), 0, 1440),
    clamp(numberProp(properties, 'bottom-y', DEFAULTS['bottom-y']), 0, 1080),
  );

  root.appendChild(svg);
  return root;
}

// Inspector schema for editor use only. Runtime reads the plain properties.
export const properties = {
  sections: [
    {
      id: 'main-menu-label',
      label: 'Main Menu Text',
      description: 'Controls for the top-left label that sits above the shield notch.',
      properties: {
        'top-text': {
          type: 'string',
          label: 'Text',
          description: 'Label drawn into the top-left title notch.',
        },
        'top-text-color': {
          type: 'color',
          label: 'Color',
          description: 'Fill color for the top-left title text.',
        },
        'top-x': {
          type: 'number',
          label: 'X',
          description: 'Horizontal position of the top label in the component viewBox.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'top-y': {
          type: 'number',
          label: 'Y',
          description: 'Vertical position of the top label in the component viewBox.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'top-font-size': {
          type: 'number',
          label: 'Font Size',
          description: 'Top label font size in viewBox pixels.',
          min: 24,
          max: 120,
          step: 1,
        },
      },
    },
    {
      id: 'bottom-text-box',
      label: 'Bottom Text Box',
      description: 'Controls for the selected menu item box and the text inside it.',
      properties: {
        'bottom-text': {
          type: 'string',
          label: 'Text',
          description: 'Text shown inside the selected bottom menu item.',
        },
        'bottom-text-color': {
          type: 'color',
          label: 'Text Color',
          description: 'Fill color for the bottom selected item text.',
        },
        'bottom-x': {
          type: 'number',
          label: 'Text X',
          description: 'Horizontal position of the bottom label in the component viewBox.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'bottom-y': {
          type: 'number',
          label: 'Text Y',
          description: 'Vertical position of the bottom label in the component viewBox.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'bottom-font-size': {
          type: 'number',
          label: 'Text Size',
          description: 'Bottom label font size in viewBox pixels.',
          min: 24,
          max: 120,
          step: 1,
        },
        'button-fill-color': {
          type: 'color',
          label: 'Box Fill',
          description: 'Interior fill color for the bottom selected item.',
        },
        'button-border-color': {
          type: 'color',
          label: 'Box Border',
          description: 'White highlight color around the bottom selected item.',
        },
        'button-x': {
          type: 'number',
          label: 'Box X',
          description: 'Bottom item x position in the component viewBox.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'button-y': {
          type: 'number',
          label: 'Box Y',
          description: 'Bottom item y position in the component viewBox.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'button-width': {
          type: 'number',
          label: 'Box Width',
          description: 'Bottom item width in the component viewBox.',
          min: 80,
          max: 1440,
          step: 1,
        },
        'button-height': {
          type: 'number',
          label: 'Box Height',
          description: 'Bottom item height in the component viewBox.',
          min: 30,
          max: 260,
          step: 1,
        },
        'button-radius': {
          type: 'number',
          label: 'Box Radius',
          description: 'Corner radius for the bottom selected item.',
          min: 0,
          max: 48,
          step: 1,
        },
        'button-border-width': {
          type: 'number',
          label: 'Box Border Width',
          description: 'Stroke width for the bottom selected item highlight.',
          min: 1,
          max: 24,
          step: 1,
        },
      },
    },
    {
      id: 'shield-frame',
      label: 'Shield Frame',
      description: 'Controls for the blue menu border, ribs, glow, and translucent frame body.',
      properties: {
        'border-color': {
          type: 'color',
          label: 'Border Color',
          description: 'Primary color used for the shield frame, ribs, and blue panel fill.',
        },
        'border-opacity': {
          type: 'number',
          label: 'Border Opacity',
          description: 'Opacity of the crisp blue outline strokes.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'fill-opacity': {
          type: 'number',
          label: 'Fill Opacity',
          description: 'Opacity of the wide translucent blue frame body.',
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
    },
  ],
};
