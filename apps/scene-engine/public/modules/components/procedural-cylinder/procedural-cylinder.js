const MAX_ROTATION_SPEED = 0.25;
const MAX_SCAN_SPEED = 0.2;

function numberProp(properties, key, fallback) {
  const value = properties[key];
  return Number.isFinite(value) ? value : fallback;
}

function colorProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  return typeof properties[key] === 'boolean' ? properties[key] : fallback;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapUnit(value) {
  return ((value % 1) + 1) % 1;
}

function scanEnvelope(position, center, width) {
  const distance = Math.abs(position - center);
  return Math.max(0, 1 - distance / Math.max(0.001, width));
}

function scanTrailEnvelope(position, center, width, trailWidth, direction) {
  const head = scanEnvelope(position, center, width);
  const trailingDistance = direction >= 0 ? center - position : position - center;
  if (trailingDistance <= width || trailingDistance > width + trailWidth) return head;
  const fade = 1 - (trailingDistance - width) / Math.max(0.001, trailWidth);
  return Math.max(head, Math.pow(fade, 1.7) * 0.54);
}

function pingPongUnit(value) {
  const phase = wrapUnit(value);
  return phase < 0.5 ? phase * 2 : (1 - phase) * 2;
}

function pingPongDirection(phase, speed) {
  const speedDirection = speed < 0 ? -1 : 1;
  return speedDirection * (phase < 0.5 ? 1 : -1);
}

function rotatePoint(x, y, z, tiltX, tiltY, tiltZ) {
  const cx = Math.cos(tiltX);
  const sx = Math.sin(tiltX);
  const cy = Math.cos(tiltY);
  const sy = Math.sin(tiltY);
  const cz = Math.cos(tiltZ);
  const sz = Math.sin(tiltZ);

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

function projectCylinderPoint(theta, vertical, options) {
  const {
    centerX,
    centerY,
    radius,
    cylinderHeight,
    cameraGap,
    cameraDistance,
    positionX,
    positionY,
    positionZ,
    nearClip,
    maxPerspective,
    tiltX,
    tiltY,
    tiltZ,
  } = options;
  const x0 = Math.cos(theta) * radius;
  const closestDepth = cameraDistance - Math.max(nearClip, cameraDistance / maxPerspective);
  const nearAxis = Math.max(0, closestDepth * (1 - cameraGap));
  const y0 = -cylinderHeight + vertical * (cylinderHeight + nearAxis);
  const z0 = Math.sin(theta) * radius;
  const rotated = rotatePoint(x0, y0, z0, tiltX, tiltY, tiltZ);
  const translated = {
    x: rotated.x + positionX,
    y: rotated.y + positionY,
    z: rotated.z + positionZ,
  };
  const cameraDepth = cameraDistance - translated.z;
  const rawPerspective = cameraDistance / Math.max(0.001, cameraDepth);
  const perspective = Math.min(rawPerspective, maxPerspective);
  const visible = cameraDepth > nearClip && rawPerspective <= maxPerspective;

  return {
    x: centerX + translated.x * perspective,
    y: centerY + translated.y * perspective,
    z: translated.z,
    visible,
    perspective,
    frontness: (Math.sin(theta) + 1) / 2,
  };
}

function strokePath(ctx, points, color, width, alpha) {
  if (points.length < 2 || alpha <= 0) return;
  const jumpLimit = Math.max(window.innerWidth || 0, window.innerHeight || 0, 900) * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let drawing = false;
  let drew = false;
  let previous = null;
  for (const point of points) {
    if (!point.visible) {
      drawing = false;
      previous = null;
      continue;
    }
    if (!drawing) {
      ctx.moveTo(point.x, point.y);
      drawing = true;
    } else {
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) > jumpLimit) {
        ctx.moveTo(point.x, point.y);
        previous = point;
        continue;
      }
      ctx.lineTo(point.x, point.y);
      drew = true;
    }
    previous = point;
  }
  if (drew) ctx.stroke();
  ctx.restore();
}

function strokeGlowPath(ctx, points, color, width, alpha) {
  if (points.length < 2 || alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  strokePath(ctx, points, color, width, alpha);
  ctx.restore();
}

function drawLineScan(ctx, linePoints, color, lineWidth, alpha, progress, pulseWidth, trailWidth, direction, illuminateAll) {
  const count = linePoints.length - 1;
  const hot = [];
  for (let i = 0; i < linePoints.length; i += 1) {
    const value = i / count;
    const intensity = illuminateAll ? 1 : scanTrailEnvelope(value, progress, pulseWidth, trailWidth, direction);
    const point = linePoints[i];
    if (point.visible && intensity > 0.04) hot.push({ ...point, index: i, intensity });
  }
  if (hot.length < 2) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < hot.length; i += 1) {
    const prev = hot[i - 1];
    const next = hot[i];
    if (Math.abs(prev.index - next.index) > 1) continue;
    if (Math.hypot(next.x - prev.x, next.y - prev.y) > Math.max(window.innerWidth || 0, window.innerHeight || 0, 900) * 0.42) continue;
    const intensity = Math.min(prev.intensity, next.intensity);
    ctx.globalAlpha = alpha * intensity;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * (illuminateAll ? 1.55 : 1.4 + intensity * 2.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  }
  ctx.restore();
}

function buildRingPoints(vertical, ringSteps, rotation, options) {
  const points = [];
  for (let i = 0; i <= ringSteps; i += 1) {
    const theta = (i / ringSteps) * Math.PI * 2 + rotation;
    points.push(projectCylinderPoint(theta, vertical, options));
  }
  return points;
}

function drawCylinder(ctx, width, height, properties, elapsed) {
  const animate = booleanProp(properties, 'animate', true);
  const centerX = width * numberProp(properties, 'center-x', 0.5);
  const centerY = height * numberProp(properties, 'center-y', 0.5);
  const radius = width * numberProp(properties, 'radius', numberProp(properties, 'radius-z', numberProp(properties, 'radius-x', 0.5)));
  const cylinderHeight = height * numberProp(properties, 'cylinder-height', numberProp(properties, 'depth', 0.72));
  const cameraGap = clamp(numberProp(properties, 'camera-gap', 0.08), 0, 0.8);
  const positionX = width * numberProp(properties, 'position-x', 0);
  const positionY = height * numberProp(properties, 'position-y', 0);
  const positionZ = height * numberProp(properties, 'position-z', 0);
  const lineCount = Math.max(4, Math.round(numberProp(properties, 'lines', 56)));
  const rings = Math.max(2, Math.round(numberProp(properties, 'rings', 10)));
  const lineWidth = numberProp(properties, 'line-width', 1.25);
  const rotationSpeed = clamp(numberProp(properties, 'rotation-speed', 0.08), -MAX_ROTATION_SPEED, MAX_ROTATION_SPEED);
  const pulseSpeed = clamp(numberProp(properties, 'pulse-speed', 0.06), -MAX_SCAN_SPEED, MAX_SCAN_SPEED);
  const rotation = (animate ? elapsed : 0) * rotationSpeed;
  const pulseWidth = numberProp(properties, 'pulse-width', 0.1);
  const pulseTrail = numberProp(properties, 'pulse-trail', 0.18);
  const scanPhase = wrapUnit(elapsed * pulseSpeed);
  const scanProgress = pingPongUnit(scanPhase);
  const scanDirection = pingPongDirection(scanPhase, pulseSpeed);
  const cameraDistance = numberProp(properties, 'camera-distance', 850);
  const nearClip = numberProp(properties, 'near-clip', Math.max(8, cameraDistance * 0.08));
  const maxPerspective = numberProp(properties, 'max-perspective', 4.8);
  const cylinderColor = colorProp(properties, 'cylinder-color', '#33709e');
  const tiltX = degreesToRadians(90 + numberProp(properties, 'tilt-x', 0));
  const tiltY = degreesToRadians(numberProp(properties, 'tilt-y', 0));
  const tiltZ = degreesToRadians(-90 + numberProp(properties, 'tilt-z', 0));
  const steps = 96;
  const ringSteps = Math.max(96, lineCount * 2);
  const options = {
    centerX,
    centerY,
    radius,
    cylinderHeight,
    cameraGap,
    cameraDistance,
    positionX,
    positionY,
    positionZ,
    nearClip,
    maxPerspective,
    tiltX,
    tiltY,
    tiltZ,
  };

  ctx.clearRect(0, 0, width, height);

  const lines = [];
  for (let i = 0; i < lineCount; i += 1) {
    const theta = (i / lineCount) * Math.PI * 2 + rotation;
    const points = [];
    let zSum = 0;
    let perspectiveSum = 0;
    let perspectiveCount = 0;
    for (let step = 0; step <= steps; step += 1) {
      const vertical = step / steps;
      const point = projectCylinderPoint(theta, vertical, options);
      zSum += point.z;
      if (point.visible) {
        perspectiveSum += point.perspective;
        perspectiveCount += 1;
      }
      points.push(point);
    }
    const avgZ = zSum / points.length;
    const avgPerspective = perspectiveCount ? perspectiveSum / perspectiveCount : maxPerspective;
    const screenX = points[Math.floor(points.length / 2)].x;
    lines.push({ theta, avgZ, avgPerspective, screenX, points, index: i });
  }

  const minZ = Math.min(...lines.map((line) => line.avgZ));
  const maxZ = Math.max(...lines.map((line) => line.avgZ));
  const zRange = Math.max(1, maxZ - minZ);

  for (const line of lines) {
    line.frontness = (line.avgZ - minZ) / zRange;
    line.edgeEmphasis = Math.pow(Math.abs((line.screenX - centerX) / Math.max(1, radius)), 1.7);
    line.nearFade = clamp((maxPerspective - line.avgPerspective) / Math.max(0.001, maxPerspective - 1), 0.16, 1);
    line.interiorAlpha = clamp((0.42 + line.edgeEmphasis * 0.2 + line.frontness * 0.08) * line.nearFade, 0.08, 0.78);
  }

  lines.sort((a, b) => a.avgZ - b.avgZ);

  if (!animate) {
    for (const line of lines) {
      const widthScale = (0.76 + line.edgeEmphasis * 0.38) * (0.74 + line.nearFade * 0.26);
      strokePath(ctx, line.points, cylinderColor, lineWidth * widthScale, clamp(line.interiorAlpha * 1.3, 0.12, 0.92));
    }
  }

  const ringPaths = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const vertical = ring / rings;
    const ringPoints = buildRingPoints(vertical, ringSteps, rotation, options);
    const isCap = ring === 0 || ring === rings;
    if (!animate) {
      strokePath(ctx, ringPoints, cylinderColor, isCap ? lineWidth * 1.35 : lineWidth * 0.75, isCap ? 0.86 : 0.52);
    }
    ringPaths.push({ vertical, points: ringPoints, isCap });
  }

  for (const line of lines) {
    const alpha = animate
      ? (0.5 + line.edgeEmphasis * 0.28 + line.frontness * 0.08) * line.nearFade
      : (0.24 + line.edgeEmphasis * 0.12) * line.nearFade;
    drawLineScan(ctx, line.points, cylinderColor, lineWidth, alpha, scanProgress, pulseWidth, pulseTrail, scanDirection, !animate);
  }

  for (const ring of ringPaths) {
    const intensity = animate ? scanTrailEnvelope(ring.vertical, scanProgress, pulseWidth * 1.4, pulseTrail, scanDirection) : 1;
    if (intensity <= 0.03) continue;
    const alpha = animate ? 0.46 * intensity : ring.isCap ? 0.34 : 0.24;
    const widthScale = animate ? 1.4 + intensity * 1.6 : ring.isCap ? 1.35 : 1;
    strokeGlowPath(ctx, ring.points, cylinderColor, lineWidth * widthScale, alpha);
  }

  if (animate) {
    const scanRing = buildRingPoints(scanProgress, ringSteps, rotation, options);
    strokeGlowPath(ctx, scanRing, cylinderColor, lineWidth * 3.1, 0.54);
  }
}

export default function ({ properties = {}, layerId } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'procedural-cylinder';
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
    drawCylinder(ctx, width, height, properties, (now - start) / 1000);
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
