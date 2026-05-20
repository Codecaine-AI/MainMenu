const VIEWBOX_WIDTH = 1440;
const VIEWBOX_HEIGHT = 1080;
const TAU = Math.PI * 2;

const RING_DEFAULTS = [
  {
    radius: 430,
    x: 838,
    y: 540,
    z: -65,
    rotateX: 72,
    rotateY: -18,
    rotateZ: -24,
    opacity: 0.66,
  },
  {
    radius: 515,
    x: 822,
    y: 535,
    z: -120,
    rotateX: 62,
    rotateY: 28,
    rotateZ: 18,
    opacity: 0.42,
  },
  {
    radius: 600,
    x: 810,
    y: 538,
    z: -175,
    rotateX: 84,
    rotateY: -5,
    rotateZ: 74,
    opacity: 0.32,
  },
];

const DEFAULTS = {
  'ring-color': '#d8d6ff',
  'ring-secondary-color': '#6d71d7',
  'line-width': 2.4,
  'glow-size': 9,
  'glow-opacity': 0.34,
  'alpha-scale': 1,
  'ring-radius': 525,
  'ring-opacity': 0.7,
  'camera-distance': 1700,
  'max-perspective': 2.4,
  samples: 360,
  'dpr-cap': 1.5,
  'dot-enabled': true,
  'dot-ring': '1',
  'dot-color': '#f2eeff',
  'dot-radius': 8,
  'dot-opacity': 0.92,
  'dot-front-scale': 0.52,
  'dot-back-scale': 1.75,
  'dot-angle': 214,
  'dot-speed': 1.15,
  'dot-front-speed': 0.34,
  'dot-back-speed': 2.25,
  'dot-direction': 'clockwise',
};

function numberProp(properties, key, fallback) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  return typeof properties[key] === 'boolean' ? properties[key] : fallback;
}

function hasNumberProp(properties, key) {
  return Number.isFinite(Number(properties[key]));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function wrapAngle(value) {
  return ((value % TAU) + TAU) % TAU;
}

function setupCanvas(canvas, ctx, width, height, dprCap) {
  const dpr = clamp(window.devicePixelRatio || 1, 1, Math.max(1, dprCap));
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function readRing(properties, index) {
  const defaults = RING_DEFAULTS[index - 1];
  const prefix = `ring-${index}`;
  const sharedRadius = numberProp(properties, 'ring-radius', DEFAULTS['ring-radius']);
  const sharedOpacity = numberProp(properties, 'ring-opacity', DEFAULTS['ring-opacity']);
  const legacyRadiusOverride = !hasNumberProp(properties, 'ring-radius') && hasNumberProp(properties, `${prefix}-radius`);
  const legacyOpacityOverride = !hasNumberProp(properties, 'ring-opacity') && hasNumberProp(properties, `${prefix}-opacity`);
  const useRadiusOverride = booleanProp(properties, `${prefix}-radius-override`, legacyRadiusOverride);
  const useOpacityOverride = booleanProp(properties, `${prefix}-opacity-override`, legacyOpacityOverride);

  return {
    index,
    radius: clamp(
      useRadiusOverride
        ? numberProp(properties, `${prefix}-radius`, sharedRadius)
        : sharedRadius,
      20,
      1400,
    ),
    x: numberProp(properties, `${prefix}-x`, defaults.x),
    y: numberProp(properties, `${prefix}-y`, defaults.y),
    z: numberProp(properties, `${prefix}-z`, defaults.z),
    rotateX: degreesToRadians(numberProp(properties, `${prefix}-rotate-x`, defaults.rotateX)),
    rotateY: degreesToRadians(numberProp(properties, `${prefix}-rotate-y`, defaults.rotateY)),
    rotateZ: degreesToRadians(numberProp(properties, `${prefix}-rotate-z`, defaults.rotateZ)),
    opacity: clamp(
      useOpacityOverride
        ? numberProp(properties, `${prefix}-opacity`, sharedOpacity)
        : sharedOpacity,
      0,
      1.5,
    ),
  };
}

function rotatePoint(x, y, z, ring) {
  const cx = Math.cos(ring.rotateX);
  const sx = Math.sin(ring.rotateX);
  const cy = Math.cos(ring.rotateY);
  const sy = Math.sin(ring.rotateY);
  const cz = Math.cos(ring.rotateZ);
  const sz = Math.sin(ring.rotateZ);

  let px = x;
  let py = y * cx - z * sx;
  let pz = y * sx + z * cx;

  const rx = px * cy + pz * sy;
  const rz = -px * sy + pz * cy;
  px = rx;
  pz = rz;

  return {
    x: px * cz - py * sz,
    y: px * sz + py * cz,
    z: pz,
  };
}

function projectRingPoint(angle, ring, cameraDistance, maxPerspective) {
  const local = rotatePoint(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0, ring);
  const z = local.z + ring.z;
  const cameraDepth = cameraDistance - z;
  const rawPerspective = cameraDistance / Math.max(1, cameraDepth);
  const perspective = clamp(rawPerspective, 0.05, maxPerspective);
  return {
    x: ring.x + local.x * perspective,
    y: ring.y + local.y * perspective,
    z,
    perspective,
    visible: cameraDepth > 1,
  };
}

function toCanvasPoint(point, scaleX, scaleY) {
  return {
    x: point.x * scaleX,
    y: point.y * scaleY,
    z: point.z,
    perspective: point.perspective,
    visible: point.visible,
  };
}

function buildRingPath(ring, options) {
  const points = [];
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i <= options.samples; i += 1) {
    const point = projectRingPoint((i / options.samples) * TAU, ring, options.cameraDistance, options.maxPerspective);
    points.push(point);
    if (point.visible) {
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
  }

  if (!Number.isFinite(minZ) || !Number.isFinite(maxZ)) {
    minZ = ring.z - 1;
    maxZ = ring.z + 1;
  }

  return { ring, points, minZ, maxZ };
}

function frontnessForZ(z, minZ, maxZ) {
  const range = Math.max(0.001, maxZ - minZ);
  return clamp((z - minZ) / range, 0, 1);
}

function ringDepthInfo(ring, cameraDistance, maxPerspective) {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < 96; i += 1) {
    const point = projectRingPoint((i / 96) * TAU, ring, cameraDistance, maxPerspective);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  return { minZ, maxZ };
}

function strokeProjectedPath(ctx, path, options, alpha) {
  if (alpha <= 0.002) return;

  ctx.globalAlpha = alpha;
  ctx.beginPath();
  let drawing = false;
  let drewLine = false;

  function flush() {
    if (drewLine) ctx.stroke();
    drawing = false;
    drewLine = false;
    ctx.beginPath();
  }

  for (const rawPoint of path.points) {
    if (!rawPoint.visible) {
      if (drawing) flush();
      continue;
    }

    const point = toCanvasPoint(rawPoint, options.scaleX, options.scaleY);
    if (!drawing) {
      ctx.moveTo(point.x, point.y);
      drawing = true;
    } else {
      ctx.lineTo(point.x, point.y);
      drewLine = true;
    }
  }

  flush();
}

function strokeSolidRings(ctx, paths, options, glowPass) {
  const ordered = [...paths]
    .filter((path) => path.ring.opacity > 0)
    .sort((a, b) => a.ring.z - b.ring.z);
  const glowAlpha = glowPass ? options.glowOpacity : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = glowPass ? options.secondaryColor : options.color;
  ctx.lineWidth = (options.lineWidth + (glowPass ? options.glowSize : 0)) * options.unitScale;

  for (const path of ordered) {
    const alpha = path.ring.opacity * options.alphaScale * glowAlpha;
    strokeProjectedPath(ctx, path, options, alpha);
  }

  ctx.restore();
}

function drawDotCircle(ctx, point, radius, color, alpha) {
  if (alpha <= 0 || radius <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = color;
  ctx.shadowBlur = radius * 1.35;
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawOrbitDot(ctx, ring, angle, options) {
  if (!options.dotEnabled || ring.opacity <= 0 || options.dotOpacity <= 0) return;

  const depth = ringDepthInfo(ring, options.cameraDistance, options.maxPerspective);
  const projected = projectRingPoint(angle, ring, options.cameraDistance, options.maxPerspective);
  if (!projected.visible) return;

  const point = toCanvasPoint(projected, options.scaleX, options.scaleY);
  const frontness = frontnessForZ(projected.z, depth.minZ, depth.maxZ);
  const depthAlpha = lerp(0.28, 1, frontness);
  const depthScale = lerp(options.dotBackScale, options.dotFrontScale, frontness);
  const sizeScale = depthScale * clamp(projected.perspective, 0.65, 1.7);
  const radius = options.dotRadius * options.unitScale * sizeScale;
  drawDotCircle(ctx, point, radius, options.dotColor, options.dotOpacity * depthAlpha);
}

function dotFrontness(ring, angle, options) {
  const point = projectRingPoint(angle, ring, options.cameraDistance, options.maxPerspective);
  const depth = ringDepthInfo(ring, options.cameraDistance, options.maxPerspective);
  return frontnessForZ(point.z, depth.minZ, depth.maxZ);
}

function drawFrame(ctx, width, height, properties, dotAngle) {
  const dprCap = numberProp(properties, 'dpr-cap', DEFAULTS['dpr-cap']);
  const options = {
    color: stringProp(properties, 'ring-color', DEFAULTS['ring-color']),
    secondaryColor: stringProp(properties, 'ring-secondary-color', DEFAULTS['ring-secondary-color']),
    lineWidth: clamp(numberProp(properties, 'line-width', DEFAULTS['line-width']), 0.1, 24),
    glowSize: clamp(numberProp(properties, 'glow-size', DEFAULTS['glow-size']), 0, 60),
    glowOpacity: clamp(numberProp(properties, 'glow-opacity', DEFAULTS['glow-opacity']), 0, 2),
    alphaScale: clamp(numberProp(properties, 'alpha-scale', DEFAULTS['alpha-scale']), 0, 2),
    cameraDistance: clamp(numberProp(properties, 'camera-distance', DEFAULTS['camera-distance']), 100, 10000),
    maxPerspective: clamp(numberProp(properties, 'max-perspective', DEFAULTS['max-perspective']), 1, 8),
    samples: Math.max(96, Math.min(960, Math.round(numberProp(properties, 'samples', DEFAULTS.samples)))),
    scaleX: width / VIEWBOX_WIDTH,
    scaleY: height / VIEWBOX_HEIGHT,
    unitScale: (width / VIEWBOX_WIDTH + height / VIEWBOX_HEIGHT) / 2,
    dotEnabled: booleanProp(properties, 'dot-enabled', DEFAULTS['dot-enabled']),
    dotColor: stringProp(properties, 'dot-color', DEFAULTS['dot-color']),
    dotRadius: clamp(numberProp(properties, 'dot-radius', DEFAULTS['dot-radius']), 0.5, 48),
    dotOpacity: clamp(numberProp(properties, 'dot-opacity', DEFAULTS['dot-opacity']), 0, 2),
    dotFrontScale: clamp(numberProp(properties, 'dot-front-scale', DEFAULTS['dot-front-scale']), 0.05, 4),
    dotBackScale: clamp(numberProp(properties, 'dot-back-scale', DEFAULTS['dot-back-scale']), 0.05, 4),
    dotDirection: stringProp(properties, 'dot-direction', DEFAULTS['dot-direction']) === 'counter-clockwise' ? -1 : 1,
    dprCap,
  };

  ctx.clearRect(0, 0, width, height);

  const rings = [readRing(properties, 1), readRing(properties, 2), readRing(properties, 3)];
  const paths = rings.map((ring) => buildRingPath(ring, options));

  strokeSolidRings(ctx, paths, options, true);
  strokeSolidRings(ctx, paths, options, false);

  const dotRingIndex = clamp(Math.round(numberProp(properties, 'dot-ring', Number(DEFAULTS['dot-ring']))), 1, 3) - 1;
  drawOrbitDot(ctx, rings[dotRingIndex], dotAngle, options);

  return { rings, options, dotRingIndex };
}

export default function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'main-menu-rings';
  root.setAttribute('aria-label', 'Main menu background rings');
  if (layerId) root.dataset.layerId = layerId;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  root.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let raf = 0;
  let lastTime = performance.now();
  let dotAngle = degreesToRadians(numberProp(properties, 'dot-angle', DEFAULTS['dot-angle']));

  const render = (now) => {
    if (!root.isConnected) {
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      return;
    }

    const rect = root.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    setupCanvas(canvas, ctx, width, height, numberProp(properties, 'dpr-cap', DEFAULTS['dpr-cap']));

    const elapsed = Math.min(0.08, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;

    const state = drawFrame(ctx, width, height, properties, dotAngle);
    const selectedRing = state.rings[state.dotRingIndex];
    const frontness = dotFrontness(selectedRing, dotAngle, state.options);
    const multiplier = lerp(
      clamp(numberProp(properties, 'dot-back-speed', DEFAULTS['dot-back-speed']), 0, 8),
      clamp(numberProp(properties, 'dot-front-speed', DEFAULTS['dot-front-speed']), 0, 8),
      frontness,
    );
    const direction = state.options.dotDirection;
    const speed = numberProp(properties, 'dot-speed', DEFAULTS['dot-speed']);
    dotAngle = wrapAngle(dotAngle + elapsed * speed * multiplier * direction);

    raf = requestAnimationFrame(render);
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(render);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });

  observer.observe(root);
  raf = requestAnimationFrame(render);

  return root;
}

function ringSection(index) {
  const prefix = `ring-${index}`;

  return {
    id: prefix,
    label: `Ring ${index}`,
    description: `3D placement and rotation for ring ${index}. X and Y use the 1440 by 1080 stage coordinate space; Z controls depth. Shared radius and opacity come from Ring Style unless overrides are enabled.`,
    properties: {
      [`${prefix}-x`]: {
        type: 'number',
        label: 'X',
        description: 'Projected center position on the stage X axis.',
        min: -400,
        max: 1840,
        step: 1,
      },
      [`${prefix}-y`]: {
        type: 'number',
        label: 'Y',
        description: 'Projected center position on the stage Y axis.',
        min: -400,
        max: 1480,
        step: 1,
      },
      [`${prefix}-z`]: {
        type: 'number',
        label: 'Z',
        description: 'Depth offset. Positive values move the ring toward the camera.',
        min: -2000,
        max: 1200,
        step: 1,
      },
      [`${prefix}-rotate-x`]: {
        type: 'number',
        label: 'Rot X',
        description: 'Rotation around the X axis in degrees.',
        min: -180,
        max: 180,
        step: 1,
      },
      [`${prefix}-rotate-y`]: {
        type: 'number',
        label: 'Rot Y',
        description: 'Rotation around the Y axis in degrees.',
        min: -180,
        max: 180,
        step: 1,
      },
      [`${prefix}-rotate-z`]: {
        type: 'number',
        label: 'Rot Z',
        description: 'Rotation around the Z axis in degrees.',
        min: -180,
        max: 180,
        step: 1,
      },
    },
    sections: [
      {
        id: `${prefix}-overrides`,
        label: 'Overrides',
        description: `Optional radius and opacity overrides for ring ${index}. Leave these disabled to keep the ring synced to Ring Style.`,
        properties: {
          [`${prefix}-radius-override`]: {
            type: 'boolean',
            label: 'Radius Ovr',
            description: 'Use this ring-specific radius instead of the shared ring radius.',
          },
          [`${prefix}-radius`]: {
            type: 'number',
            label: 'Radius',
            description: 'Ring-specific radius used only when Radius Override is enabled.',
            min: 20,
            max: 1400,
            step: 1,
          },
          [`${prefix}-opacity-override`]: {
            type: 'boolean',
            label: 'Opacity Ovr',
            description: 'Use this ring-specific opacity instead of the shared ring opacity.',
          },
          [`${prefix}-opacity`]: {
            type: 'number',
            label: 'Opacity',
            description: 'Ring-specific opacity used only when Opacity Override is enabled.',
            min: 0,
            max: 1.5,
            step: 0.01,
          },
        },
      },
    ],
  };
}

export const properties = {
  sections: [
    {
      id: 'style',
      label: 'Ring Style',
      description: 'Shared color, glow, opacity, and camera settings for the background ring object.',
      properties: {
        'ring-color': {
          type: 'color',
          label: 'Core Color',
          description: 'Crisp line color for the rings.',
        },
        'ring-secondary-color': {
          type: 'color',
          label: 'Glow Color',
          description: 'Soft glow color drawn under the ring cores.',
        },
        'line-width': {
          type: 'number',
          label: 'Line Width',
          description: 'Core ring stroke width in CSS pixels.',
          min: 0.1,
          max: 24,
          step: 0.1,
        },
        'glow-size': {
          type: 'number',
          label: 'Glow Size',
          description: 'Extra glow stroke width around each ring.',
          min: 0,
          max: 60,
          step: 0.5,
        },
        'glow-opacity': {
          type: 'number',
          label: 'Glow Opacity',
          description: 'Opacity multiplier for the glow pass.',
          min: 0,
          max: 2,
          step: 0.01,
        },
        'alpha-scale': {
          type: 'number',
          label: 'Alpha',
          description: 'Uniform opacity multiplier for the full ring stroke.',
          min: 0,
          max: 2,
          step: 0.01,
        },
        'camera-distance': {
          type: 'number',
          label: 'Camera',
          description: 'Perspective camera distance. Larger values flatten the projection.',
          min: 100,
          max: 10000,
          step: 10,
        },
        'max-perspective': {
          type: 'number',
          label: 'Max Persp',
          description: 'Upper clamp for close-to-camera perspective scaling.',
          min: 1,
          max: 8,
          step: 0.1,
        },
        samples: {
          type: 'number',
          label: 'Curve Detail',
          description: 'Number of points used to draw each continuous ring curve. Higher values are smoother and more expensive.',
          min: 96,
          max: 960,
          step: 12,
        },
        'dpr-cap': {
          type: 'number',
          label: 'DPR Cap',
          description: 'Maximum device pixel ratio used by the canvas.',
          min: 1,
          max: 3,
          step: 0.1,
        },
      },
      sections: [
        {
          id: 'ring-details',
          label: 'Ring Details',
          description: 'Shared radius and opacity values used by all rings. Enable a ring override only when one ring needs to break sync.',
          properties: {
            'ring-radius': {
              type: 'number',
              label: 'Radius',
              description: 'Shared radius used by all rings unless a ring-specific radius override is enabled.',
              min: 20,
              max: 1400,
              step: 1,
            },
            'ring-opacity': {
              type: 'number',
              label: 'Opacity',
              description: 'Shared opacity used by all rings before layer appearance opacity is applied, unless a ring-specific opacity override is enabled.',
              min: 0,
              max: 1.5,
              step: 0.01,
            },
          },
        },
      ],
    },
    ringSection(1),
    ringSection(2),
    ringSection(3),
    {
      id: 'orbit-dot',
      label: 'Orbit Dot',
      description: 'Small circle that rides one ring. Its speed interpolates from fast on the back side to slow on the front side.',
      properties: {
        'dot-enabled': {
          type: 'boolean',
          label: 'Visible',
          description: 'Show the solid orbiting dot.',
        },
        'dot-ring': {
          type: 'select',
          label: 'Ring',
          description: 'Which ring the dot travels around.',
          options: [
            { value: '1', label: 'Ring 1' },
            { value: '2', label: 'Ring 2' },
            { value: '3', label: 'Ring 3' },
          ],
        },
        'dot-color': {
          type: 'color',
          label: 'Color',
          description: 'Dot core and glow color.',
        },
        'dot-radius': {
          type: 'number',
          label: 'Radius',
          description: 'Base dot radius in CSS pixels before front/back depth scaling.',
          min: 0.5,
          max: 48,
          step: 0.5,
        },
        'dot-opacity': {
          type: 'number',
          label: 'Opacity',
          description: 'Dot opacity multiplier.',
          min: 0,
          max: 2,
          step: 0.01,
        },
        'dot-front-scale': {
          type: 'number',
          label: 'Front Scale',
          description: 'Dot size multiplier when the dot is on the front half of the ring.',
          min: 0.05,
          max: 4,
          step: 0.01,
        },
        'dot-back-scale': {
          type: 'number',
          label: 'Back Scale',
          description: 'Dot size multiplier when the dot is on the back half of the ring.',
          min: 0.05,
          max: 4,
          step: 0.01,
        },
        'dot-angle': {
          type: 'number',
          label: 'Start Angle',
          description: 'Initial angle on the selected ring in degrees.',
          min: 0,
          max: 360,
          step: 1,
        },
        'dot-speed': {
          type: 'number',
          label: 'Base Speed',
          description: 'Base angular speed in radians per second before front/back speed multipliers.',
          min: -4,
          max: 4,
          step: 0.01,
        },
        'dot-front-speed': {
          type: 'number',
          label: 'Front Speed',
          description: 'Speed multiplier when the dot is on the front half of the ring.',
          min: 0,
          max: 8,
          step: 0.01,
        },
        'dot-back-speed': {
          type: 'number',
          label: 'Back Speed',
          description: 'Speed multiplier when the dot is on the back half of the ring.',
          min: 0,
          max: 8,
          step: 0.01,
        },
        'dot-direction': {
          type: 'select',
          label: 'Direction',
          description: 'Travel direction around the selected ring.',
          options: [
            { value: 'clockwise', label: 'Clockwise' },
            { value: 'counter-clockwise', label: 'Counter' },
          ],
        },
      },
    },
  ],
};
