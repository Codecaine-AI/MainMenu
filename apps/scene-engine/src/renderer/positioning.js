const ANCHOR_TRANSLATE = {
  'top-left': '0, 0',
  'top': '-50%, 0',
  'top-right': '-100%, 0',
  'left': '0, -50%',
  'center': '-50%, -50%',
  'right': '-100%, -50%',
  'bottom-left': '0, -100%',
  'bottom': '-50%, -100%',
  'bottom-right': '-100%, -100%',
};

function sizeToCss(value) {
  if (value === 'auto') return 'auto';
  if (typeof value === 'number') return `${value}%`;
  return null;
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
  el.style.left = `${transform.x ?? 0}%`;
  el.style.top = `${transform.y ?? 0}%`;

  const w = sizeToCss(transform.width);
  if (w !== null) el.style.width = w;
  const h = sizeToCss(transform.height);
  if (h !== null) el.style.height = h;

  const anchor = transform.anchor ?? 'top-left';
  const translate = ANCHOR_TRANSLATE[anchor] ?? ANCHOR_TRANSLATE['top-left'];
  const hasAnchorTranslate = anchor !== 'top-left';

  const parts = [];
  if (hasAnchorTranslate) parts.push(`translate(${translate})`);
  if (transform.rotation && transform.rotation !== 0) parts.push(`rotate(${transform.rotation}deg)`);
  if (transform.scale != null && transform.scale !== 1) parts.push(`scale(${transform.scale})`);
  el.style.transform = parts.length ? parts.join(' ') : '';
  el.style.transformOrigin = hasAnchorTranslate ? '0 0' : '';
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
  if (typeof appearance.hue === 'number') {
    el.style.filter = appearance.hue !== 0 ? `hue-rotate(${appearance.hue}deg)` : '';
  }
  if (isMedia && mediaEl && typeof appearance.fit === 'string') {
    mediaEl.style.objectFit = appearance.fit;
  }
}
