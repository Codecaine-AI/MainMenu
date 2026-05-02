const DEFAULTS = {
  'top-height': 8,
  'bottom-height': 8,
  'top-curve': 2,
  'bottom-curve': 98,
  'contour': 24,
  'color': '#000000',
  'opacity': 1,
  'edge-feather': 0,
};

function numberValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pct(value, fallback, min = 0, max = 100) {
  return clamp(numberValue(value, fallback), min, max);
}

export default function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'arc-letterbox';
  if (layerId) root.dataset.layerId = layerId;

  const topHeight = pct(properties['top-height'], DEFAULTS['top-height'], 0, 50);
  const bottomHeight = pct(properties['bottom-height'], DEFAULTS['bottom-height'], 0, 50);
  const topCurve = pct(properties['top-curve'], DEFAULTS['top-curve'], 0, 50);
  const bottomCurve = pct(properties['bottom-curve'], DEFAULTS['bottom-curve'], 50, 100);
  const contour = pct(properties.contour, DEFAULTS.contour, 0, 50);
  const leftControl = contour;
  const rightControl = 100 - contour;
  const opacity = clamp(numberValue(properties.opacity, DEFAULTS.opacity), 0, 1);
  const color = typeof properties.color === 'string' ? properties.color : DEFAULTS.color;
  const feather = pct(properties['edge-feather'], DEFAULTS['edge-feather'], 0, 8);
  const filterAttr = feather > 0 ? ' filter="url(#arc-letterbox-feather)"' : '';

  const topPath = [
    'M 0 0',
    'H 100',
    `V ${topHeight}`,
    `C ${rightControl} ${topCurve}, ${leftControl} ${topCurve}, 0 ${topHeight}`,
    'Z',
  ].join(' ');

  const bottomTop = 100 - bottomHeight;
  const bottomPath = [
    `M 0 ${bottomTop}`,
    `C ${leftControl} ${bottomCurve}, ${rightControl} ${bottomCurve}, 100 ${bottomTop}`,
    'V 100',
    'H 0',
    'Z',
  ].join(' ');

  root.innerHTML = `
    <svg class="arc-letterbox__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="arc-letterbox-feather" x="-2%" y="-2%" width="104%" height="104%">
          <feGaussianBlur stdDeviation="${feather * 0.18}" />
        </filter>
      </defs>
      <path d="${topPath}" fill="${color}" opacity="${opacity}"${filterAttr}></path>
      <path d="${bottomPath}" fill="${color}" opacity="${opacity}"${filterAttr}></path>
    </svg>
  `;

  return root;
}
