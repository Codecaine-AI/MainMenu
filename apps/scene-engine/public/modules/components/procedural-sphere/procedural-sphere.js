function numberProp(properties, key, fallback) {
  const value = properties[key];
  return Number.isFinite(value) ? value : fallback;
}

function colorProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function setupCanvas(canvas, ctx, width, height) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function rotationOptions(properties) {
  const legacyTilt = numberProp(properties, 'tilt', 0);
  return {
    rotateX: degreesToRadians(numberProp(properties, 'rotate-x', legacyTilt)),
    rotateY: degreesToRadians(numberProp(properties, 'rotate-y', 0)),
    rotateZ: degreesToRadians(numberProp(properties, 'rotate-z', 0)),
  };
}

function rotatePoint(x, y, z, rotations) {
  const cx = Math.cos(rotations.rotateX);
  const sx = Math.sin(rotations.rotateX);
  const cy = Math.cos(rotations.rotateY);
  const sy = Math.sin(rotations.rotateY);
  const cz = Math.cos(rotations.rotateZ);
  const sz = Math.sin(rotations.rotateZ);

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

function projectPoint(lambda, phi, radius, rotation, rotations) {
  const orbit = lambda + rotation;
  const x0 = radius * Math.cos(phi) * Math.sin(orbit);
  const y0 = radius * Math.sin(phi);
  const z0 = radius * Math.cos(phi) * Math.cos(orbit);
  return rotatePoint(x0, y0, z0, rotations);
}

function drawPolyline(ctx, points, cx, cy) {
  let drawing = false;
  for (const point of points) {
    if (point.z < 0) {
      drawing = false;
      continue;
    }
    const x = cx + point.x;
    const y = cy + point.y;
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
}

function panelPoint(lambda, phi, width, height, rotation, options) {
  const { sphereWidth, sphereHeight, sphereX, sphereY, sphereZ, rotations, cameraNear, cameraFov } = options;
  const orbit = lambda + rotation;
  const x0 = Math.cos(phi) * Math.sin(orbit) * sphereWidth;
  const y0 = Math.sin(phi) * sphereHeight;
  const z0 = Math.cos(phi) * Math.cos(orbit);
  const rotated = rotatePoint(x0, y0, z0, rotations);
  const x3 = rotated.x;
  const y3 = rotated.y;
  const z3 = rotated.z + sphereZ;
  const viewDepth = -z3;
  const visible = viewDepth > cameraNear;
  const perspective = cameraFov / Math.max(cameraNear, viewDepth);
  return {
    x: width / 2 + sphereX * width + x3 * width * 0.68 * perspective,
    y: height * 0.5 + sphereY * height + y3 * height * 0.62 * perspective,
    z: z3,
    visible,
    alpha: Math.max(0.08, Math.min(1, 0.24 + Math.min(1.4, perspective) * 0.46)),
  };
}

function strokeInteriorPath(ctx, points, color, lineWidth, alphaScale = 1) {
  let drawing = false;
  let alphaSum = 0;
  let alphaCount = 0;

  ctx.beginPath();
  for (const point of points) {
    if (!point.visible) {
      drawing = false;
      continue;
    }
    alphaSum += point.alpha;
    alphaCount += 1;
    if (!drawing) {
      ctx.moveTo(point.x, point.y);
      drawing = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }

  if (alphaCount === 0) return;
  const alpha = alphaSum / alphaCount;
  ctx.globalAlpha = alpha * alphaScale;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawInteriorSphere(ctx, width, height, properties, elapsed) {
  const rotation = elapsed * numberProp(properties, 'rotation-speed', 0.26);
  const longitudes = Math.max(6, Math.round(numberProp(properties, 'longitudes', 32)));
  const latitudes = Math.max(4, Math.round(numberProp(properties, 'latitudes', 18)));
  const sphereWidth = numberProp(properties, 'sphere-width', 1);
  const sphereHeight = numberProp(properties, 'sphere-height', 1);
  const sphereX = numberProp(properties, 'sphere-x', 0);
  const sphereY = numberProp(properties, 'sphere-y', 0);
  const sphereZ = numberProp(properties, 'sphere-z', 0);
  const cameraNear = numberProp(properties, 'camera-near', 0.12);
  const cameraFov = numberProp(properties, 'camera-fov', 0.32);
  const grid = colorProp(properties, 'grid', 'rgba(74, 93, 112, 0.7)');
  const vignette = colorProp(properties, 'vignette', 'rgba(0, 0, 0, 0.86)');
  const lineWidth = numberProp(properties, 'line-width', 1.4);
  const poleRadius = numberProp(properties, 'pole-radius', 0.18);
  const poleGap = numberProp(properties, 'pole-gap', 0.1);
  const steps = 112;
  const rotations = rotationOptions(properties);
  const projection = { sphereWidth, sphereHeight, sphereX, sphereY, sphereZ, rotations, cameraNear, cameraFov };
  const capAngle = Math.min(Math.PI / 2 - 0.02, Math.max(0, poleRadius));
  const gapAngle = Math.min(Math.PI / 2 - capAngle - 0.02, Math.max(0, poleGap));
  const lowerPolePhi = -Math.PI / 2 + capAngle;
  const upperPolePhi = Math.PI / 2 - capAngle;
  const minPhi = lowerPolePhi + gapAngle;
  const maxPhi = upperPolePhi - gapAngle;

  ctx.clearRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width / 2,
    height * 0.48,
    height * 0.08,
    width / 2,
    height * 0.5,
    width * 0.62,
  );
  glow.addColorStop(0, 'rgba(110, 120, 126, 0.16)');
  glow.addColorStop(0.48, 'rgba(44, 50, 64, 0.1)');
  glow.addColorStop(1, vignette);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < longitudes; i += 1) {
    const lambda = (i / longitudes) * Math.PI * 2;
    const points = [];
    for (let s = 0; s <= steps; s += 1) {
      const phi = minPhi + (s / steps) * (maxPhi - minPhi);
      points.push(panelPoint(lambda, phi, width, height, rotation, projection));
    }
    strokeInteriorPath(ctx, points, grid, lineWidth, 0.42);
  }

  const latitudePhis = [lowerPolePhi, minPhi, maxPhi, upperPolePhi];
  for (let i = 1; i < latitudes; i += 1) {
    latitudePhis.push(minPhi + (i / latitudes) * (maxPhi - minPhi));
  }

  for (const phi of latitudePhis) {
    const points = [];
    for (let s = 0; s <= steps; s += 1) {
      const lambda = (s / steps) * Math.PI * 2;
      points.push(panelPoint(lambda, phi, width, height, rotation, projection));
    }
    const isPole = phi === lowerPolePhi || phi === upperPolePhi;
    const isGapEdge = phi === minPhi || phi === maxPhi;
    const emphasis = isPole ? 0.72 : isGapEdge ? 0.58 : 0.38;
    strokeInteriorPath(ctx, points, grid, isPole || isGapEdge ? lineWidth * 1.15 : lineWidth, emphasis);
  }
  ctx.restore();

  const shade = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.22,
    width / 2,
    height / 2,
    width * 0.58,
  );
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(0.68, 'rgba(0, 0, 0, 0.18)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

function drawSphere(ctx, width, height, properties, elapsed) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * numberProp(properties, 'radius-scale', 0.44);
  const rotation = elapsed * numberProp(properties, 'rotation-speed', 0.45);
  const rotations = rotationOptions({ ...properties, 'rotate-x': numberProp(properties, 'rotate-x', numberProp(properties, 'tilt', -18)) });
  const longitudes = Math.max(4, Math.round(numberProp(properties, 'longitudes', 28)));
  const latitudes = Math.max(3, Math.round(numberProp(properties, 'latitudes', 18)));
  const fill = colorProp(properties, 'fill', 'rgba(205, 208, 201, 0.82)');
  const highlight = colorProp(properties, 'highlight', 'rgba(255, 255, 246, 0.42)');
  const grid = colorProp(properties, 'grid', 'rgba(42, 45, 45, 0.52)');
  const rim = colorProp(properties, 'rim', 'rgba(12, 14, 16, 0.72)');
  const scan = colorProp(properties, 'scan', 'rgba(52, 82, 205, 0.2)');
  const lineWidth = numberProp(properties, 'line-width', 1.25);
  const steps = 160;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(
    cx - radius * 0.34,
    cy - radius * 0.42,
    radius * 0.08,
    cx,
    cy,
    radius * 1.12,
  );
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(0.34, fill);
  gradient.addColorStop(1, 'rgba(60, 64, 62, 0.9)');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.clip();

  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = grid;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < longitudes; i += 1) {
    const lambda = (i / longitudes) * Math.PI * 2;
    const points = [];
    for (let s = 0; s <= steps; s += 1) {
      const phi = -Math.PI / 2 + (s / steps) * Math.PI;
      points.push(projectPoint(lambda, phi, radius, rotation, rotations));
    }
    ctx.beginPath();
    drawPolyline(ctx, points, cx, cy);
    ctx.stroke();
  }

  for (let i = 1; i < latitudes; i += 1) {
    const phi = -Math.PI / 2 + (i / latitudes) * Math.PI;
    const points = [];
    for (let s = 0; s <= steps; s += 1) {
      const lambda = (s / steps) * Math.PI * 2;
      points.push(projectPoint(lambda, phi, radius, rotation, rotations));
    }
    ctx.beginPath();
    drawPolyline(ctx, points, cx, cy);
    ctx.stroke();
  }

  ctx.strokeStyle = scan;
  ctx.lineWidth = lineWidth * 1.45;
  for (const phi of [-1.18, 1.18]) {
    ctx.beginPath();
    for (let s = 0; s <= steps; s += 1) {
      const lambda = (s / steps) * Math.PI * 2;
      const point = projectPoint(lambda, phi, radius, rotation, rotations);
      const x = cx + point.x;
      const y = cy + point.y;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = rim;
  ctx.lineWidth = lineWidth * 1.8;
  ctx.stroke();
}

export default function ({ properties = {}, layerId } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'procedural-sphere';
  if (layerId) wrap.dataset.layerId = layerId;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let raf = 0;
  let start = performance.now();

  const render = (now) => {
    if (!wrap.isConnected) {
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    setupCanvas(canvas, ctx, width, height);
    if (properties.mode === 'interior') {
      drawInteriorSphere(ctx, width, height, properties, (now - start) / 1000);
    } else {
      drawSphere(ctx, width, height, properties, (now - start) / 1000);
    }
    raf = requestAnimationFrame(render);
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !raf) {
      start = performance.now();
      raf = requestAnimationFrame(render);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });

  observer.observe(wrap);
  raf = requestAnimationFrame(render);

  return wrap;
}

// Inspector schema — editor-only; the runtime ignores this export.
export const properties = {
  sections: [
    {
      id: 'mode',
      label: 'Mode',
      description:
        'Whether the sphere is rendered as a solid filled globe (standard) or a wireframe interior view (interior). Each mode uses a different subset of the properties below.',
      properties: {
        mode: {
          type: 'select',
          label: 'Render Mode',
          description: 'Solid (standard) or wireframe interior (interior).',
          options: ['standard', 'interior'],
        },
      },
    },
    {
      id: 'rotation',
      label: 'Rotation',
      description:
        'Auto-rotation around each axis. Speed is the spin rate; rotate-x/y/z are static tilt offsets in degrees applied before the spin.',
      properties: {
        'rotation-speed': {
          type: 'number',
          label: 'Rotation Speed',
          description: 'Radians per second the sphere auto-rotates around its primary axis.',
          min: -2,
          max: 2,
          step: 0.01,
        },
        'rotate-x': {
          type: 'number',
          label: 'Tilt X (deg)',
          description: 'Static rotation around the X axis, in degrees, applied before auto-rotation.',
          min: -180,
          max: 180,
          step: 1,
        },
        'rotate-y': {
          type: 'number',
          label: 'Tilt Y (deg)',
          description: 'Static rotation around the Y axis, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
        'rotate-z': {
          type: 'number',
          label: 'Tilt Z (deg)',
          description: 'Static rotation around the Z axis, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
        tilt: {
          type: 'number',
          label: 'Legacy Tilt (deg)',
          description:
            'Legacy single-axis tilt — fallback for rotate-x when rotate-x is unset. New scenes should use rotate-x directly.',
          min: -180,
          max: 180,
          step: 1,
        },
      },
    },
    {
      id: 'geometry',
      label: 'Geometry',
      description:
        'Number of meridian/parallel lines drawn, line width, and (interior mode) the polar cap radius and gap.',
      properties: {
        longitudes: {
          type: 'number',
          label: 'Longitudes',
          description: 'Number of vertical meridian lines.',
          min: 4,
          max: 96,
          step: 1,
        },
        latitudes: {
          type: 'number',
          label: 'Latitudes',
          description: 'Number of horizontal parallel lines.',
          min: 3,
          max: 64,
          step: 1,
        },
        'line-width': {
          type: 'number',
          label: 'Line Width',
          description: 'Stroke width of the grid lines, in CSS pixels.',
          min: 0.25,
          max: 6,
          step: 0.05,
        },
        'radius-scale': {
          type: 'number',
          label: 'Radius Scale (standard)',
          description:
            "Standard mode only. Sphere radius as a fraction of the layer's shorter side. Ignored in interior mode.",
          min: 0.05,
          max: 1,
          step: 0.01,
        },
        'pole-radius': {
          type: 'number',
          label: 'Pole Cap Radius (interior)',
          description: 'Interior mode only. Angular radius of the polar caps, in radians.',
          min: 0,
          max: 1.5,
          step: 0.01,
        },
        'pole-gap': {
          type: 'number',
          label: 'Pole Gap (interior)',
          description:
            'Interior mode only. Angular gap between the polar cap and the meridian grid, in radians.',
          min: 0,
          max: 0.5,
          step: 0.01,
        },
      },
    },
    {
      id: 'position',
      label: 'Position (3D)',
      description:
        "Interior mode only. Translates and stretches the sphere within the layer's viewport — sphere-width/height stretch along the camera's X/Y, sphere-x/y/z translate.",
      properties: {
        'sphere-width': {
          type: 'number',
          label: 'Sphere Width',
          description: 'Horizontal radius scale (interior).',
          min: 0.1,
          max: 5,
          step: 0.01,
        },
        'sphere-height': {
          type: 'number',
          label: 'Sphere Height',
          description: 'Vertical radius scale (interior).',
          min: 0.1,
          max: 5,
          step: 0.01,
        },
        'sphere-x': {
          type: 'number',
          label: 'Sphere X',
          description: 'Horizontal offset within the layer, fraction of layer width.',
          min: -2,
          max: 2,
          step: 0.01,
        },
        'sphere-y': {
          type: 'number',
          label: 'Sphere Y',
          description: 'Vertical offset within the layer, fraction of layer height.',
          min: -2,
          max: 2,
          step: 0.01,
        },
        'sphere-z': {
          type: 'number',
          label: 'Sphere Z',
          description: 'Depth offset (interior). Negative pushes the sphere away from the camera.',
          min: -3,
          max: 3,
          step: 0.01,
        },
        depth: {
          type: 'number',
          label: 'Depth (legacy)',
          description:
            'Legacy depth knob — read by some scenes alongside sphere-z. New scenes should set sphere-z directly.',
          min: -3,
          max: 3,
          step: 0.01,
        },
      },
    },
    {
      id: 'camera',
      label: 'Camera (interior)',
      description:
        'Interior mode only. Near-clip distance and field-of-view multiplier control how aggressively the camera zooms into the wireframe.',
      properties: {
        'camera-near': {
          type: 'number',
          label: 'Near Clip',
          description: 'Closest depth before geometry is culled (interior).',
          min: 0.01,
          max: 1,
          step: 0.01,
        },
        'camera-fov': {
          type: 'number',
          label: 'Field of View',
          description: 'Camera focal multiplier (interior). Larger values widen the apparent FOV.',
          min: 0.05,
          max: 1.5,
          step: 0.01,
        },
      },
    },
    {
      id: 'colors',
      label: 'Colors',
      description:
        'CSS color strings (rgba(), hex, named).',
      properties: {
        fill: {
          type: 'color',
          label: 'Fill (standard)',
          description: 'Sphere body fill color. CSS color string.',
        },
        highlight: {
          type: 'color',
          label: 'Highlight (standard)',
          description: 'Specular highlight color. CSS color string.',
        },
        grid: {
          type: 'color',
          label: 'Grid',
          description: 'Meridian/parallel line color. CSS color string. Used by both modes.',
        },
        rim: {
          type: 'color',
          label: 'Rim (standard)',
          description: 'Outline color around the sphere silhouette. CSS color string.',
        },
        scan: {
          type: 'color',
          label: 'Scan (standard)',
          description: 'Color of the two horizontal scan lines drawn over the sphere. CSS color string.',
        },
        vignette: {
          type: 'color',
          label: 'Vignette (interior)',
          description: 'Outer gradient color for the interior view. CSS color string.',
        },
      },
    },
  ],
};
