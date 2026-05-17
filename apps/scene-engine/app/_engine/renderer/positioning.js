const ANCHOR_AXIS_TRANSLATE = {
  'top-left': ['0', '0'],
  'top': ['-50%', '0'],
  'top-right': ['-100%', '0'],
  'left': ['0', '-50%'],
  'center': ['-50%', '-50%'],
  'right': ['-100%', '-50%'],
  'bottom-left': ['0', '-100%'],
  'bottom': ['-50%', '-100%'],
  'bottom-right': ['-100%', '-100%'],
};

const PIN_X = {
  left: { position: '0%', translate: '0', origin: 'left' },
  center: { position: '50%', translate: '-50%', origin: 'center' },
  right: { position: '100%', translate: '-100%', origin: 'right' },
};

const PIN_Y = {
  top: { position: '0%', translate: '0', origin: 'top' },
  center: { position: '50%', translate: '-50%', origin: 'center' },
  middle: { position: '50%', translate: '-50%', origin: 'center' },
  bottom: { position: '100%', translate: '-100%', origin: 'bottom' },
};

function sizeToCss(value) {
  if (value === 'auto') return 'auto';
  if (typeof value === 'number') return `${value}%`;
  return null;
}

function resolveAxis(value, pins, anchorTranslate, fallback, originForTranslate) {
  if (typeof value === 'string' && pins[value]) {
    return pins[value];
  }
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return { position: `${n}%`, translate: anchorTranslate, origin: originForTranslate(anchorTranslate) };
}

function originXForTranslate(translate) {
  if (translate === '-100%') return 'right';
  if (translate === '-50%') return 'center';
  return 'left';
}

function originYForTranslate(translate) {
  if (translate === '-100%') return 'bottom';
  if (translate === '-50%') return 'center';
  return 'top';
}

export function applyTransform(el, transform) {
  el.style.position = 'absolute';

  if (!transform) return;

  if (transform.mode === 'fill') {
    el.style.inset = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.left = '';
    el.style.top = '';
    const parts = [];
    if (transform.rotation && transform.rotation !== 0) parts.push(`rotate(${transform.rotation}deg)`);
    if (transform.scale != null && transform.scale !== 1) parts.push(`scale(${transform.scale})`);
    el.style.transform = parts.length ? parts.join(' ') : '';
    el.style.transformOrigin = parts.length ? 'center center' : '';
    return;
  }

  el.style.inset = '';

  const w = sizeToCss(transform.width);
  if (w !== null) el.style.width = w;
  const h = sizeToCss(transform.height);
  if (h !== null) el.style.height = h;

  const anchor = transform.anchor ?? 'top-left';
  const anchorTranslate = ANCHOR_AXIS_TRANSLATE[anchor] ?? ANCHOR_AXIS_TRANSLATE['top-left'];
  const x = resolveAxis(transform.x, PIN_X, anchorTranslate[0], 0, originXForTranslate);
  const y = resolveAxis(transform.y, PIN_Y, anchorTranslate[1], 0, originYForTranslate);
  el.style.left = x.position;
  el.style.top = y.position;
  const hasTranslate = x.translate !== '0' || y.translate !== '0';

  const parts = [];
  if (hasTranslate) parts.push(`translate(${x.translate}, ${y.translate})`);
  if (transform.rotation && transform.rotation !== 0) parts.push(`rotate(${transform.rotation}deg)`);
  if (transform.scale != null && transform.scale !== 1) parts.push(`scale(${transform.scale})`);
  el.style.transform = parts.length ? parts.join(' ') : '';
  el.style.transformOrigin = parts.length ? `${x.origin} ${y.origin}` : '';
}

export function applyAppearance(el, appearance, options = {}) {
  if (!appearance) return;
  const { isMedia = false, mediaEl = null } = options;

  if (typeof appearance.opacity === 'number') {
    el.style.opacity = String(appearance.opacity);
  }
  if (typeof appearance.blend === 'string') {
    el.style.mixBlendMode = appearance.blend;
  }
  const filters = [];
  if (typeof appearance.hue === 'number' && appearance.hue !== 0) {
    filters.push(`hue-rotate(${appearance.hue}deg)`);
  }
  if (typeof appearance.saturation === 'number' && appearance.saturation !== 1) {
    filters.push(`saturate(${appearance.saturation})`);
  }
  el.style.filter = filters.join(' ');
  if (isMedia && mediaEl && typeof appearance.fit === 'string') {
    mediaEl.style.objectFit = appearance.fit;
  }
}
