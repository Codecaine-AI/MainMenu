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
  'top-text-opacity': 1,
  'top-text-glow-color': '#a7a9b7',
  'top-text-glow-size': 0,
  'top-text-glow-opacity': 0,
  'bottom-text-color': '#e4e7ff',
  'button-border-color': '#eef1ff',
  'button-fill-color': '#03040a',
  'top-x': 232,
  'top-y': 136,
  'top-font-size': 64,
  'top-box-x': 176,
  'top-box-y': 88,
  'top-box-width': 445,
  'top-box-height': 76,
  'top-fit-padding-x': 16,
  'top-fit-padding-y': 8,
  'top-min-font-size': 18,
  'bottom-x': 725,
  'bottom-y': 944,
  'bottom-font-size': 56,
  'button-x': 344,
  'button-y': 902,
  'button-width': 762,
  'button-height': 84,
  'button-radius': 11,
  'button-border-width': 7,
  'bottom-fit-padding-x': 44,
  'bottom-fit-padding-y': 18,
  'bottom-min-font-size': 12,
  'bottom-center-in-box': true,
  'debug-text-boxes': false,
};

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

function hasProp(properties, key) {
  return Object.prototype.hasOwnProperty.call(properties, key);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorWithAlpha(color, alpha) {
  const opacity = clamp(Number(alpha), 0, 1);
  const raw = String(color ?? '').trim();
  const shortHex = raw.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((digit) => parseInt(`${digit}${digit}`, 16));
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const hex = raw.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const value = hex[1];
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  const rgb = raw.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+)?\s*\)$/);
  if (rgb) return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${opacity})`;
  return raw || `rgba(167, 169, 183, ${opacity})`;
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

function fitBottomText(label) {
  const availableWidth = Number(label.dataset.menuShieldFitWidth);
  const availableHeight = Number(label.dataset.menuShieldFitHeight);
  const baseFontSize = Number(label.dataset.menuShieldFitBase);
  const minFontSize = Number(label.dataset.menuShieldFitMin);
  if (![availableWidth, availableHeight, baseFontSize, minFontSize].every(Number.isFinite)) return;

  label.style.fontSize = `${baseFontSize.toFixed(3)}px`;

  let measuredWidth = estimateTextLength(label.textContent || '', baseFontSize);
  let measuredHeight = baseFontSize;
  if (typeof label.getComputedTextLength === 'function') {
    try {
      const renderedWidth = label.getComputedTextLength();
      if (Number.isFinite(renderedWidth) && renderedWidth > 0) measuredWidth = renderedWidth;
    } catch {
      // Detached SVG nodes can fail measurement before the scene mounts.
    }
  }
  if (typeof label.getBBox === 'function') {
    try {
      const box = label.getBBox();
      if (Number.isFinite(box.width) && box.width > 0) measuredWidth = Math.max(measuredWidth, box.width);
      if (Number.isFinite(box.height) && box.height > 0) measuredHeight = box.height;
    } catch {
      // Detached SVG nodes can fail measurement before the scene mounts.
    }
  }

  if (measuredWidth <= 0 || measuredHeight <= 0) return;
  const targetWidth = availableWidth * 0.92;
  const widthScale = targetWidth / measuredWidth;
  const heightScale = availableHeight / measuredHeight;
  let fittedFontSize = clamp(baseFontSize * Math.min(1, widthScale, heightScale), minFontSize, baseFontSize);
  label.style.fontSize = `${fittedFontSize.toFixed(3)}px`;

  if (typeof label.getBBox === 'function') {
    for (let i = 0; i < 4; i += 1) {
      try {
        const finalBox = label.getBBox();
        const finalWidthScale = finalBox.width > 0 ? targetWidth / finalBox.width : 1;
        const finalHeightScale = finalBox.height > 0 ? availableHeight / finalBox.height : 1;
        const finalScale = Math.min(1, finalWidthScale, finalHeightScale);
        if (finalScale >= 0.995) break;
        fittedFontSize = clamp(fittedFontSize * finalScale, minFontSize, fittedFontSize);
        label.style.fontSize = `${fittedFontSize.toFixed(3)}px`;
      } catch {
        // Detached SVG nodes can fail measurement before the scene mounts.
        break;
      }
    }
  }
}

function appendDebugTextBox(parent, className, x, y, width, height) {
  parent.appendChild(svgEl('rect', {
    class: `menu-shield__text-debug-box ${className}`,
    x,
    y,
    width,
    height,
  }));
}

function settleBottomText(label) {
  const availableWidth = Number(label.dataset.menuShieldFitWidth);
  const availableHeight = Number(label.dataset.menuShieldFitHeight);
  const minFontSize = Number(label.dataset.menuShieldFitMin);
  if (![availableWidth, availableHeight, minFontSize].every(Number.isFinite)) return;
  if (typeof label.getBBox !== 'function') return;

  const targetWidth = availableWidth * 0.92;
  let currentFontSize = parseFloat(label.style.fontSize || getComputedStyle(label).fontSize);
  if (!Number.isFinite(currentFontSize) || currentFontSize <= 0) return;

  for (let i = 0; i < 4; i += 1) {
    try {
      const box = label.getBBox();
      const widthScale = box.width > 0 ? targetWidth / box.width : 1;
      const heightScale = box.height > 0 ? availableHeight / box.height : 1;
      const scale = Math.min(1, widthScale, heightScale);
      if (scale >= 0.995) break;
      currentFontSize = clamp(currentFontSize * scale, minFontSize, currentFontSize);
      label.style.fontSize = `${currentFontSize.toFixed(3)}px`;
    } catch {
      break;
    }
  }
}

function fitAndSettleBottomText(label) {
  fitBottomText(label);

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      settleBottomText(label);
      requestAnimationFrame(() => settleBottomText(label));
    });
  } else {
    settleBottomText(label);
  }
}

function queueBottomTextFit(label) {
  fitAndSettleBottomText(label);

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => fitAndSettleBottomText(label));
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => fitAndSettleBottomText(label)).catch(() => {});
  }
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
  const topTextColor = stringProp(properties, 'top-text-color', DEFAULTS['top-text-color']);
  const topTextOpacity = clamp(numberProp(properties, 'top-text-opacity', DEFAULTS['top-text-opacity']), 0, 1);
  const topTextGlowSize = clamp(numberProp(properties, 'top-text-glow-size', DEFAULTS['top-text-glow-size']), 0, 80);
  const topTextGlowOpacity = clamp(numberProp(properties, 'top-text-glow-opacity', DEFAULTS['top-text-glow-opacity']), 0, 1);
  const topTextGlowColor = stringProp(properties, 'top-text-glow-color', topTextColor);
  const showDebugTextBoxes = booleanProp(properties, 'debug-text-boxes', DEFAULTS['debug-text-boxes']);
  root.style.setProperty('--menu-shield-border', stringProp(properties, 'border-color', DEFAULTS['border-color']));
  root.style.setProperty('--menu-shield-border-opacity', String(borderOpacity));
  root.style.setProperty('--menu-shield-inner-opacity', String(borderOpacity * 0.88));
  root.style.setProperty('--menu-shield-rib-opacity', String(borderOpacity * 0.92));
  root.style.setProperty('--menu-shield-break-opacity', String(borderOpacity * 0.72));
  root.style.setProperty('--menu-shield-fill-opacity', String(fillOpacity));
  root.style.setProperty('--menu-shield-top-text', topTextColor);
  root.style.setProperty('--menu-shield-top-text-opacity', String(topTextOpacity));
  root.style.setProperty('--menu-shield-top-text-glow-size', `${topTextGlowSize}px`);
  root.style.setProperty('--menu-shield-top-text-glow-color', colorWithAlpha(topTextGlowColor, topTextGlowOpacity));
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
  const topBaseFontSize = clamp(numberProp(properties, 'top-font-size', DEFAULTS['top-font-size']), 24, 120);
  const topMinFontSize = clamp(numberProp(properties, 'top-min-font-size', DEFAULTS['top-min-font-size']), 6, topBaseFontSize);
  const topBoxWidth = clamp(numberProp(properties, 'top-box-width', DEFAULTS['top-box-width']), 40, 1440);
  const topBoxHeight = clamp(numberProp(properties, 'top-box-height', DEFAULTS['top-box-height']), 24, 220);
  const topBoxXFallback = hasProp(properties, 'top-x')
    ? numberProp(properties, 'top-x', DEFAULTS['top-box-x'])
    : DEFAULTS['top-box-x'];
  const topBoxYFallback = hasProp(properties, 'top-y')
    ? numberProp(properties, 'top-y', DEFAULTS['top-box-y'] + topBoxHeight / 2) - topBoxHeight / 2
    : DEFAULTS['top-box-y'];
  const topBoxX = clamp(numberProp(properties, 'top-box-x', topBoxXFallback), 0, 1440);
  const topBoxY = clamp(numberProp(properties, 'top-box-y', topBoxYFallback), 0, 1080);
  const topFitPaddingX = clamp(
    numberProp(properties, 'top-fit-padding-x', DEFAULTS['top-fit-padding-x']),
    0,
    Math.max(0, topBoxWidth / 2 - 1),
  );
  const topFitPaddingY = clamp(
    numberProp(properties, 'top-fit-padding-y', DEFAULTS['top-fit-padding-y']),
    0,
    Math.max(0, topBoxHeight / 2 - 1),
  );
  const topFitBox = {
    x: topBoxX + topFitPaddingX,
    y: topBoxY + topFitPaddingY,
    width: Math.max(1, topBoxWidth - topFitPaddingX * 2),
    height: Math.max(1, topBoxHeight - topFitPaddingY * 2),
  };
  const bottomBaseFontSize = clamp(numberProp(properties, 'bottom-font-size', DEFAULTS['bottom-font-size']), 24, 120);
  const bottomMinFontSize = clamp(numberProp(properties, 'bottom-min-font-size', DEFAULTS['bottom-min-font-size']), 6, bottomBaseFontSize);
  const bottomFitPaddingX = clamp(
    numberProp(properties, 'bottom-fit-padding-x', Math.max(DEFAULTS['bottom-fit-padding-x'], buttonBorderWidth * 4)),
    0,
    Math.max(0, buttonWidth / 2 - 1),
  );
  const bottomFitPaddingY = clamp(
    numberProp(properties, 'bottom-fit-padding-y', Math.max(DEFAULTS['bottom-fit-padding-y'], buttonBorderWidth * 2)),
    0,
    Math.max(0, buttonHeight / 2 - 1),
  );
  const bottomFitBox = {
    x: buttonX + bottomFitPaddingX,
    y: buttonY + bottomFitPaddingY,
    width: Math.max(1, buttonWidth - bottomFitPaddingX * 2),
    height: Math.max(1, buttonHeight - bottomFitPaddingY * 2),
  };
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

  const topText = appendText(
    svg,
    'menu-shield__top-text',
    stringProp(properties, 'top-text', DEFAULTS['top-text']),
    topFitBox.x + topFitBox.width,
    topFitBox.y + topFitBox.height / 2,
    'end',
  );
  topText.dataset.menuShieldFitWidth = String(topFitBox.width);
  topText.dataset.menuShieldFitHeight = String(topFitBox.height);
  topText.dataset.menuShieldFitBase = String(topBaseFontSize);
  topText.dataset.menuShieldFitMin = String(topMinFontSize);
  fitBottomText(topText);

  const bottomTextX = booleanProp(properties, 'bottom-center-in-box', DEFAULTS['bottom-center-in-box'])
    ? buttonX + buttonWidth / 2
    : clamp(numberProp(properties, 'bottom-x', DEFAULTS['bottom-x']), 0, 1440);
  const bottomTextY = booleanProp(properties, 'bottom-center-in-box', DEFAULTS['bottom-center-in-box'])
    ? buttonY + buttonHeight / 2
    : clamp(numberProp(properties, 'bottom-y', DEFAULTS['bottom-y']), 0, 1080);
  const bottomText = appendText(
    svg,
    'menu-shield__bottom-text',
    stringProp(properties, 'bottom-text', DEFAULTS['bottom-text']),
    bottomTextX,
    bottomTextY,
  );
  bottomText.dataset.menuShieldFitWidth = String(bottomFitBox.width);
  bottomText.dataset.menuShieldFitHeight = String(bottomFitBox.height);
  bottomText.dataset.menuShieldFitBase = String(bottomBaseFontSize);
  bottomText.dataset.menuShieldFitMin = String(bottomMinFontSize);
  fitBottomText(bottomText);

  if (showDebugTextBoxes) {
    const debug = svgEl('g', { class: 'menu-shield__text-debug' });
    appendDebugTextBox(debug, 'menu-shield__text-debug-box--title', topFitBox.x, topFitBox.y, topFitBox.width, topFitBox.height);
    appendDebugTextBox(debug, 'menu-shield__text-debug-box--caption', bottomFitBox.x, bottomFitBox.y, bottomFitBox.width, bottomFitBox.height);
    svg.appendChild(debug);
  }

  root.appendChild(svg);
  queueBottomTextFit(topText);
  queueBottomTextFit(bottomText);
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
        'top-text-opacity': {
          type: 'number',
          label: 'Opacity',
          description: 'Opacity for the top-left title text.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'top-text-glow-size': {
          type: 'number',
          label: 'Glow Size',
          description: 'Soft glow radius for the top-left title text.',
          min: 0,
          max: 40,
          step: 0.5,
        },
        'top-text-glow-opacity': {
          type: 'number',
          label: 'Glow Alpha',
          description: 'Opacity for the top-left title glow.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'top-x': {
          type: 'number',
          label: 'X',
          description: 'Legacy horizontal position for the top label. The title fit box controls current alignment.',
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
        'top-box-x': {
          type: 'number',
          label: 'Box X',
          description: 'Left edge of the right-aligned top title fit box.',
          min: 0,
          max: 1440,
          step: 1,
        },
        'top-box-y': {
          type: 'number',
          label: 'Box Y',
          description: 'Top edge of the right-aligned top title fit box.',
          min: 0,
          max: 1080,
          step: 1,
        },
        'top-box-width': {
          type: 'number',
          label: 'Box Width',
          description: 'Width used to right-align and auto-fit the top title.',
          min: 40,
          max: 1440,
          step: 1,
        },
        'top-box-height': {
          type: 'number',
          label: 'Box Height',
          description: 'Height used to auto-fit the top title.',
          min: 24,
          max: 220,
          step: 1,
        },
        'top-fit-padding-x': {
          type: 'number',
          label: 'Pad X',
          description: 'Horizontal inset inside the top title fit box.',
          min: 0,
          max: 120,
          step: 1,
        },
        'top-fit-padding-y': {
          type: 'number',
          label: 'Pad Y',
          description: 'Vertical inset inside the top title fit box.',
          min: 0,
          max: 80,
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
        'bottom-center-in-box': {
          type: 'boolean',
          label: 'Center Text',
          description: 'Center the bottom label inside the selected item box.',
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
        'debug-text-boxes': {
          type: 'boolean',
          label: 'Show Text Boxes',
          description: 'Draw debug rectangles around the title and caption text fit boxes.',
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
