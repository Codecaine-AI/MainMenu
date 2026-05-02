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

// Inspector schema for editor use only — runtime ignores it.
export const properties = {
  sections: [
    {
      id: 'top-bar',
      label: 'Top Bar',
      properties: {
        'top-height': {
          type: 'number',
          label: 'Top Height',
          description: 'Height of the top letterbox bar as a percentage of layer height. 0 hides the top bar.',
          min: 0,
          max: 50,
          step: 0.5,
        },
        'top-curve': {
          type: 'number',
          label: 'Top Curve',
          description: "Vertical position of the top bar's inner curve control point. Lower values make the curve sweep upward more aggressively.",
          min: 0,
          max: 50,
          step: 0.5,
        },
      },
    },
    {
      id: 'bottom-bar',
      label: 'Bottom Bar',
      properties: {
        'bottom-height': {
          type: 'number',
          label: 'Bottom Height',
          description: 'Height of the bottom letterbox bar as a percentage of layer height. 0 hides the bottom bar.',
          min: 0,
          max: 50,
          step: 0.5,
        },
        'bottom-curve': {
          type: 'number',
          label: 'Bottom Curve',
          description: "Vertical position of the bottom bar's inner curve control point. Higher values make the curve sweep downward more aggressively.",
          min: 50,
          max: 100,
          step: 0.5,
        },
      },
    },
    {
      id: 'curvature',
      label: 'Curvature',
      description: 'The contour value sets the bezier control inset shared by both bars — it shapes how dramatically the inner edges arc inward.',
      properties: {
        contour: {
          type: 'number',
          label: 'Contour',
          description: 'Horizontal inset of the curve control points from the layer edges. Lower values pull the bezier handles toward the center, narrowing the arc; higher values flatten it.',
          min: 0,
          max: 50,
          step: 0.5,
        },
      },
    },
    {
      id: 'appearance',
      label: 'Appearance',
      properties: {
        color: {
          type: 'string',
          label: 'Color',
          description: 'Fill color of both letterbox bars. CSS color string (hex, rgba, named).',
        },
        opacity: {
          type: 'number',
          label: 'Opacity',
          description: 'Per-bar opacity, 0–1. Applied to both bars uniformly.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'edge-feather': {
          type: 'number',
          label: 'Edge Feather',
          description: 'Gaussian blur applied to both bar edges, 0–8. 0 leaves edges crisp; higher values soften the silhouette.',
          min: 0,
          max: 8,
          step: 0.1,
        },
      },
    },
  ],
};
