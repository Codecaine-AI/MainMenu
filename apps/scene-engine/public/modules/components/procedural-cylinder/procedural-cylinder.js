const MAX_ROTATION_SPEED = 0.5;
const MAX_SCAN_SPEED = 0.2;
const MAX_DOT_SPEED = 1.2;

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

function hasProperty(properties, key) {
  return Object.prototype.hasOwnProperty.call(properties, key);
}

function resolveAnimationMode(properties) {
  if (booleanProp(properties, 'disable-animation', false)) return 'static';

  const hasModeProps =
    hasProperty(properties, 'disable-animation') ||
    hasProperty(properties, 'animation-one') ||
    hasProperty(properties, 'animation-two') ||
    hasProperty(properties, 'animation-three');

  const legacyAnimate = booleanProp(properties, 'animate', true);
  if (!hasModeProps) return legacyAnimate ? 'scan' : 'static';

  if (booleanProp(properties, 'animation-three', false)) return 'sequence';
  if (booleanProp(properties, 'animation-two', false)) return 'dot-field';
  if (booleanProp(properties, 'animation-one', legacyAnimate)) return 'scan';
  return 'static';
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

function positiveDuration(value, fallback) {
  return Math.max(0.001, Number.isFinite(value) && value > 0 ? value : fallback);
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

function segmentEnvelope(position, center, headWidth, trailWidth, direction, wrapPath) {
  if (wrapPath) {
    const delta = wrapUnit((position - center) * direction);
    if (delta <= headWidth) return 1;
    if (delta > headWidth + trailWidth) return 0;
    const fade = 1 - (delta - headWidth) / Math.max(0.001, trailWidth);
    return Math.pow(fade, 1.45);
  }

  const head = scanEnvelope(position, center, headWidth);
  const trailingDistance = direction >= 0 ? center - position : position - center;
  if (trailingDistance <= headWidth || trailingDistance > headWidth + trailWidth) return head;
  const fade = 1 - (trailingDistance - headWidth) / Math.max(0.001, trailWidth);
  return Math.max(head, Math.pow(fade, 1.45));
}

function drawAnimatedSegment(ctx, points, color, width, alpha, progress, segmentWidth, trailWidth, direction, wrapPath) {
  const count = points.length - 1;
  if (count < 1 || alpha <= 0) return;

  const jumpLimit = Math.max(window.innerWidth || 0, window.innerHeight || 0, 900) * 0.42;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (!prev.visible || !next.visible) continue;
    if (Math.hypot(next.x - prev.x, next.y - prev.y) > jumpLimit) continue;

    const position = ((i - 0.5) / count);
    const intensity = segmentEnvelope(position, progress, segmentWidth, trailWidth, direction, wrapPath);
    if (intensity <= 0.035) continue;

    const frontness = ((prev.frontness || 0) + (next.frontness || 0)) * 0.5;
    const perspective = ((prev.perspective || 1) + (next.perspective || 1)) * 0.5;
    const depthScale = clamp(0.74 + frontness * 0.34 + perspective * 0.04, 0.64, 1.28);
    ctx.globalAlpha = alpha * intensity;
    ctx.lineWidth = width * depthScale * (0.76 + intensity * 0.34);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
  }
}

function buildRingPoints(vertical, ringSteps, rotation, options) {
  const points = [];
  for (let i = 0; i <= ringSteps; i += 1) {
    const theta = (i / ringSteps) * Math.PI * 2 + rotation;
    points.push(projectCylinderPoint(theta, vertical, options));
  }
  return points;
}

function drawBaseGrid(ctx, lines, ringPaths, color, lineWidth, intensity) {
  for (const line of lines) {
    const widthScale = (0.76 + line.edgeEmphasis * 0.38) * (0.74 + line.nearFade * 0.26);
    const alpha = clamp(line.interiorAlpha * 1.3 * intensity, 0.03 * intensity, 0.92 * intensity);
    strokePath(ctx, line.points, color, lineWidth * widthScale, alpha);
  }

  for (const ring of ringPaths) {
    strokePath(
      ctx,
      ring.points,
      color,
      ring.isCap ? lineWidth * 1.35 : lineWidth * 0.75,
      (ring.isCap ? 0.86 : 0.52) * intensity,
    );
  }
}

function drawStaticGlow(ctx, lines, ringPaths, color, lineWidth) {
  for (const line of lines) {
    const alpha = (0.24 + line.edgeEmphasis * 0.12) * line.nearFade;
    drawLineScan(ctx, line.points, color, lineWidth, alpha, 0, 1, 0, 1, true);
  }

  for (const ring of ringPaths) {
    strokeGlowPath(ctx, ring.points, color, lineWidth * (ring.isCap ? 1.35 : 1), ring.isCap ? 0.34 : 0.24);
  }
}

function drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, progress, direction, rotation, ringSteps, options, opacity = 1) {
  if (opacity <= 0) return;
  const pulseWidth = numberProp(properties, 'pulse-width', 0.1);
  const pulseTrail = numberProp(properties, 'pulse-trail', 0.18);
  const scanProgress = clamp(progress, 0, 1);

  for (const line of lines) {
    const alpha = (0.5 + line.edgeEmphasis * 0.28 + line.frontness * 0.08) * line.nearFade * opacity;
    drawLineScan(ctx, line.points, color, lineWidth, alpha, scanProgress, pulseWidth, pulseTrail, direction, false);
  }

  for (const ring of ringPaths) {
    const intensity = scanTrailEnvelope(ring.vertical, scanProgress, pulseWidth * 1.4, pulseTrail, direction);
    if (intensity <= 0.03) continue;
    strokeGlowPath(ctx, ring.points, color, lineWidth * (1.4 + intensity * 1.6), 0.46 * intensity * opacity);
  }

  const scanRing = buildRingPoints(scanProgress, ringSteps, rotation, options);
  strokeGlowPath(ctx, scanRing, color, lineWidth * 3.1, 0.54 * opacity);
}

function drawScanAnimation(ctx, lines, ringPaths, color, lineWidth, properties, elapsed, rotation, ringSteps, options) {
  const pulseSpeed = clamp(numberProp(properties, 'pulse-speed', 0.06), -MAX_SCAN_SPEED, MAX_SCAN_SPEED);
  const scanPhase = wrapUnit(elapsed * pulseSpeed);
  const scanProgress = pingPongUnit(scanPhase);
  const scanDirection = pingPongDirection(scanPhase, pulseSpeed);
  drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, scanProgress, scanDirection, rotation, ringSteps, options);
}

function drawDotFieldAnimation(ctx, lines, ringPaths, color, lineWidth, properties, elapsed, opacity = 1) {
  if (opacity <= 0) return;
  const dotSpeed = clamp(numberProp(properties, 'dot-speed', 0.22), -MAX_DOT_SPEED, MAX_DOT_SPEED);
  const segmentLineWidth = Math.max(0.1, numberProp(properties, 'dot-size', lineWidth * 1.6));
  const dotDensity = Math.max(1, Math.round(numberProp(properties, 'dot-density', 1)));
  const lineDensity = Math.max(1, Math.round(numberProp(properties, 'line-segment-density', dotDensity)));
  const ringDensity = Math.max(1, Math.round(numberProp(properties, 'ring-segment-density', Math.min(2, dotDensity))));
  const segmentTrail = clamp(numberProp(properties, 'dot-trail', 0.085), 0, 0.45);
  const dotAlpha = clamp(numberProp(properties, 'dot-alpha', 0.78), 0, 1.5);
  const segmentWidth = clamp(numberProp(properties, 'segment-width', 0.026), 0.002, 0.25);
  const linePhaseGroups = 8;
  const ringPhaseGroups = 6;
  const speedMagnitude = Math.abs(dotSpeed);
  const speedSign = dotSpeed < 0 ? -1 : 1;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const line of lines) {
    const mirrorIndex = Math.min(line.index, Math.max(0, lines.length - 1 - line.index));
    const phaseOffset = (mirrorIndex % linePhaseGroups) / linePhaseGroups;
    const baseDirection = ((Math.floor(line.index / 2) % 2 === 0) ? 1 : -1) * speedSign;
    for (let lane = 0; lane < lineDensity; lane += 1) {
      const lanePair = Math.floor(lane / 2);
      const laneDirection = lane % 2 === 0 ? baseDirection : -baseDirection;
      const laneOffset = (lanePair + (lane % 2) * 0.5) / Math.max(1, Math.ceil(lineDensity / 2));
      const phase = wrapUnit(elapsed * speedMagnitude * laneDirection + phaseOffset + laneOffset);
      const progress = pingPongUnit(phase);
      const direction = pingPongDirection(phase, laneDirection);
      const alpha = dotAlpha * (0.45 + line.edgeEmphasis * 0.22 + line.frontness * 0.14) * line.nearFade * opacity;
      drawAnimatedSegment(ctx, line.points, color, segmentLineWidth, alpha, progress, segmentWidth, segmentTrail, direction, false);
    }
  }

  for (const ring of ringPaths) {
    const ringDirection = (ring.index % 2 === 0 ? 1 : -1) * speedSign;
    const phaseOffset = ((ring.index % ringPhaseGroups) + (Math.floor(ring.index / ringPhaseGroups) % 2) * 0.5) / ringPhaseGroups;
    for (let lane = 0; lane < ringDensity; lane += 1) {
      const laneOffset = lane / ringDensity;
      const progress = wrapUnit(elapsed * speedMagnitude * ringDirection + phaseOffset + laneOffset);
      const direction = ringDirection < 0 ? -1 : 1;
      const alpha = dotAlpha * (ring.isCap ? 0.58 : 0.36) * opacity;
      drawAnimatedSegment(ctx, ring.points, color, segmentLineWidth, alpha, progress, segmentWidth, segmentTrail, direction, true);
    }
  }

  ctx.restore();
}

function drawSequenceAnimation(ctx, lines, ringPaths, color, lineWidth, properties, elapsed, rotation, ringSteps, options) {
  const pulseSpeed = Math.abs(clamp(numberProp(properties, 'pulse-speed', 0.06), -MAX_SCAN_SPEED, MAX_SCAN_SPEED));
  const dotSpeed = Math.abs(clamp(numberProp(properties, 'dot-speed', 0.22), -MAX_DOT_SPEED, MAX_DOT_SPEED));
  const scanFallback = 1 / Math.max(0.001, pulseSpeed || 0.06);
  const dotFallback = 1 / Math.max(0.001, dotSpeed || 0.22);
  const scanDuration = positiveDuration(numberProp(properties, 'sequence-scan-duration', scanFallback), scanFallback);
  const dotCycles = Math.max(0.001, numberProp(properties, 'sequence-dot-cycles', 2));
  const dotDuration = positiveDuration(dotCycles / Math.max(0.001, dotSpeed || 0.22), dotFallback);
  const fadeDuration = Math.min(
    Math.max(0, numberProp(properties, 'sequence-fade-duration', 0.7)),
    scanDuration * 0.45,
    dotDuration * 0.45,
  );
  const totalDuration = scanDuration * 2 + dotDuration * 2;
  let phaseTime = ((elapsed % totalDuration) + totalDuration) % totalDuration;

  if (phaseTime < scanDuration) {
    const progress = phaseTime / scanDuration;
    const dotOpacity = phaseTime > scanDuration - fadeDuration ? 1 - (scanDuration - phaseTime) / fadeDuration : 0;
    drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, progress, 1, rotation, ringSteps, options, 1 - dotOpacity);
    drawDotFieldAnimation(ctx, lines, ringPaths, color, lineWidth, properties, phaseTime - scanDuration, dotOpacity);
    return;
  }
  phaseTime -= scanDuration;

  if (phaseTime < dotDuration) {
    const dotOpacity = phaseTime > dotDuration - fadeDuration ? (dotDuration - phaseTime) / fadeDuration : 1;
    const scanOpacity = 1 - dotOpacity;
    const scanProgress = scanOpacity > 0 ? clamp(1 - (phaseTime - (dotDuration - fadeDuration)) / scanDuration, 0, 1) : 1;
    drawDotFieldAnimation(ctx, lines, ringPaths, color, lineWidth, properties, phaseTime, dotOpacity);
    drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, scanProgress, -1, rotation, ringSteps, options, scanOpacity);
    return;
  }
  phaseTime -= dotDuration;

  if (phaseTime < scanDuration) {
    const progress = 1 - phaseTime / scanDuration;
    const dotOpacity = phaseTime > scanDuration - fadeDuration ? 1 - (scanDuration - phaseTime) / fadeDuration : 0;
    drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, progress, -1, rotation, ringSteps, options, 1 - dotOpacity);
    drawDotFieldAnimation(ctx, lines, ringPaths, color, lineWidth, properties, phaseTime - scanDuration, dotOpacity);
    return;
  }
  phaseTime -= scanDuration;

  const dotOpacity = phaseTime > dotDuration - fadeDuration ? (dotDuration - phaseTime) / fadeDuration : 1;
  const scanOpacity = 1 - dotOpacity;
  const scanProgress = scanOpacity > 0 ? clamp((phaseTime - (dotDuration - fadeDuration)) / scanDuration, 0, 1) : 0;
  drawDotFieldAnimation(ctx, lines, ringPaths, color, lineWidth, properties, phaseTime, dotOpacity);
  drawScanPass(ctx, lines, ringPaths, color, lineWidth, properties, scanProgress, 1, rotation, ringSteps, options, scanOpacity);
}

function drawCylinder(ctx, width, height, properties, elapsed) {
  const animationMode = resolveAnimationMode(properties);
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
  const rotation = animationMode === 'static' ? 0 : elapsed * rotationSpeed;
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

  const ringPaths = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const vertical = ring / rings;
    const ringPoints = buildRingPoints(vertical, ringSteps, rotation, options);
    const isCap = ring === 0 || ring === rings;
    ringPaths.push({ index: ring, vertical, points: ringPoints, isCap });
  }

  if (animationMode === 'static') {
    drawBaseGrid(ctx, lines, ringPaths, cylinderColor, lineWidth, 1);
    drawStaticGlow(ctx, lines, ringPaths, cylinderColor, lineWidth);
  } else if (animationMode === 'dot-field') {
    drawDotFieldAnimation(ctx, lines, ringPaths, cylinderColor, lineWidth, properties, elapsed);
  } else if (animationMode === 'sequence') {
    drawSequenceAnimation(ctx, lines, ringPaths, cylinderColor, lineWidth, properties, elapsed, rotation, ringSteps, options);
  } else {
    drawScanAnimation(ctx, lines, ringPaths, cylinderColor, lineWidth, properties, elapsed, rotation, ringSteps, options);
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

// Inspector schema — editor-only; the runtime ignores this export.
export const properties = {
  sections: [
    {
      id: 'mode',
      label: 'Animation Mode',
      description:
        'Selects the animation pass. Static draws no movement; Scan sweeps a vertical pulse along the lines; Dot Field flows lit dot trails along each line and ring; Sequence cycles scan→dot→reverse-scan→dot continuously.',
      properties: {
        'disable-animation': {
          type: 'boolean',
          label: 'Static (Disable Animation)',
          description: 'When true, no animation runs — only the static grid and glow render.',
        },
        'animation-one': {
          type: 'boolean',
          label: 'Mode: Scan',
          description:
            'Enable the scan pulse animation (mutually exclusive with the other animation toggles).',
        },
        'animation-two': {
          type: 'boolean',
          label: 'Mode: Dot Field',
          description: 'Enable the lit dot-trail animation along lines and rings.',
        },
        'animation-three': {
          type: 'boolean',
          label: 'Mode: Sequence',
          description: 'Cycle through scan → dot-field → reverse-scan → dot-field on a loop.',
        },
        animate: {
          type: 'boolean',
          label: 'Animate (legacy)',
          description:
            'Legacy on/off used before the four-mode toggles existed. Treated as scan-mode when no other mode toggle is set.',
        },
      },
    },
    {
      id: 'rotation',
      label: 'Rotation',
      description: 'Auto-rotation of the cylinder around its primary axis.',
      properties: {
        'rotation-speed': {
          type: 'number',
          label: 'Rotation Speed',
          description: 'Radians per second the cylinder auto-rotates. Clamped to ±0.25 internally.',
          min: -0.25,
          max: 0.25,
          step: 0.005,
        },
      },
    },
    {
      id: 'geometry',
      label: 'Geometry',
      description:
        "Number of vertical lines and horizontal rings, line stroke width, and the cylinder's radius/height.",
      properties: {
        lines: {
          type: 'number',
          label: 'Lines',
          description: 'Number of vertical lines around the cylinder.',
          min: 4,
          max: 256,
          step: 1,
        },
        rings: {
          type: 'number',
          label: 'Rings',
          description: 'Number of horizontal rings (including caps).',
          min: 2,
          max: 64,
          step: 1,
        },
        'line-width': {
          type: 'number',
          label: 'Line Width',
          description: 'Stroke width of grid lines, in CSS pixels.',
          min: 0.25,
          max: 6,
          step: 0.05,
        },
        radius: {
          type: 'number',
          label: 'Radius',
          description: 'Cylinder radius as a fraction of layer width.',
          min: 0.05,
          max: 2,
          step: 0.01,
        },
        'radius-x': {
          type: 'number',
          label: 'Radius X (legacy)',
          description: 'Legacy fallback for radius when radius and radius-z are unset.',
          min: 0.05,
          max: 2,
          step: 0.01,
        },
        'radius-z': {
          type: 'number',
          label: 'Radius Z (legacy)',
          description: 'Legacy fallback for radius when radius is unset; takes precedence over radius-x.',
          min: 0.05,
          max: 2,
          step: 0.01,
        },
        'cylinder-height': {
          type: 'number',
          label: 'Cylinder Height',
          description: 'Cylinder body height as a fraction of layer height.',
          min: 0.05,
          max: 2,
          step: 0.01,
        },
        depth: {
          type: 'number',
          label: 'Depth (legacy)',
          description: 'Legacy fallback for cylinder-height when cylinder-height is unset.',
          min: 0.05,
          max: 2,
          step: 0.01,
        },
      },
    },
    {
      id: 'position',
      label: 'Position (3D)',
      description:
        'Where the cylinder sits within the layer. center-x/y are the projection center; position-x/y/z translate the cylinder in world space before projection.',
      properties: {
        'center-x': {
          type: 'number',
          label: 'Center X',
          description: 'Horizontal projection center, fraction of layer width.',
          min: -1,
          max: 2,
          step: 0.01,
        },
        'center-y': {
          type: 'number',
          label: 'Center Y',
          description: 'Vertical projection center, fraction of layer height.',
          min: -1,
          max: 2,
          step: 0.01,
        },
        'position-x': {
          type: 'number',
          label: 'Position X',
          description: 'World-space X translation, fraction of layer width.',
          min: -2,
          max: 2,
          step: 0.01,
        },
        'position-y': {
          type: 'number',
          label: 'Position Y',
          description: 'World-space Y translation, fraction of layer height.',
          min: -2,
          max: 2,
          step: 0.01,
        },
        'position-z': {
          type: 'number',
          label: 'Position Z',
          description:
            'World-space Z translation. Negative pushes the cylinder away from the camera.',
          min: -2,
          max: 2,
          step: 0.01,
        },
      },
    },
    {
      id: 'tilt',
      label: 'Tilt',
      description:
        'Static rotation around each axis (in degrees) applied before the auto-rotation. Tilt-X has a 90° baseline added internally so the default lays the cylinder vertical.',
      properties: {
        'tilt-x': {
          type: 'number',
          label: 'Tilt X (deg)',
          description: 'Tilt around the X axis, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
        'tilt-y': {
          type: 'number',
          label: 'Tilt Y (deg)',
          description: 'Tilt around the Y axis, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
        'tilt-z': {
          type: 'number',
          label: 'Tilt Z (deg)',
          description: 'Tilt around the Z axis, in degrees.',
          min: -180,
          max: 180,
          step: 1,
        },
      },
    },
    {
      id: 'camera',
      label: 'Camera',
      description:
        'Pinhole projection parameters. camera-distance is the camera→origin distance; camera-gap shrinks the visible top end; near-clip drops geometry too close; max-perspective caps the divergence ratio.',
      properties: {
        'camera-distance': {
          type: 'number',
          label: 'Camera Distance',
          description: 'Distance from the camera to world-origin, in pixels.',
          min: 100,
          max: 4000,
          step: 10,
        },
        'camera-gap': {
          type: 'number',
          label: 'Camera Gap',
          description: 'Top-end gap as a fraction of camera distance. Internally clamped to 0–0.8.',
          min: 0,
          max: 0.8,
          step: 0.01,
        },
        'near-clip': {
          type: 'number',
          label: 'Near Clip',
          description: 'Closest depth before geometry is culled, in pixels.',
          min: 1,
          max: 1000,
          step: 1,
        },
        'max-perspective': {
          type: 'number',
          label: 'Max Perspective',
          description:
            'Cap on the perspective divergence ratio (cameraDistance / depth). Higher = more wide-angle.',
          min: 1.5,
          max: 12,
          step: 0.1,
        },
      },
    },
    {
      id: 'color',
      label: 'Color',
      description: 'CSS color string for the cylinder grid. Plain string in v1.',
      properties: {
        'cylinder-color': {
          type: 'color',
          label: 'Cylinder Color',
          description: 'CSS color (hex, rgba, named) for grid lines and glow.',
        },
      },
    },
    {
      id: 'scan',
      label: 'Scan Animation',
      description:
        'Tunables for the scan pulse pass. pulse-width is the head-of-pulse half-width; pulse-trail is the trailing fade length; pulse-speed controls direction and rate (negative reverses).',
      properties: {
        'pulse-width': {
          type: 'number',
          label: 'Pulse Width',
          description: 'Half-width of the scan pulse head, fraction of cylinder length.',
          min: 0.01,
          max: 0.5,
          step: 0.005,
        },
        'pulse-trail': {
          type: 'number',
          label: 'Pulse Trail',
          description: 'Trailing fade length behind the pulse head, fraction of cylinder length.',
          min: 0,
          max: 0.5,
          step: 0.005,
        },
        'pulse-speed': {
          type: 'number',
          label: 'Pulse Speed',
          description:
            'Scan oscillation rate. Internally clamped to ±0.2; negative inverts direction.',
          min: -0.2,
          max: 0.2,
          step: 0.005,
        },
      },
    },
    {
      id: 'dot-field',
      label: 'Dot Field Animation',
      description:
        'Tunables for the dot-field pass — lit dot trails flow along each line and ring at lane-staggered phases.',
      properties: {
        'dot-speed': {
          type: 'number',
          label: 'Dot Speed',
          description:
            'Flow rate of the dot lanes. Internally clamped to ±1.2; negative inverts direction.',
          min: -1.2,
          max: 1.2,
          step: 0.01,
        },
        'dot-size': {
          type: 'number',
          label: 'Dot Size',
          description: 'Stroke width of each dot trail segment, in CSS pixels.',
          min: 0.25,
          max: 8,
          step: 0.05,
        },
        'dot-density': {
          type: 'number',
          label: 'Dot Density',
          description: 'Number of concurrent dot lanes per line. Higher = busier field.',
          min: 1,
          max: 8,
          step: 1,
        },
        'dot-trail': {
          type: 'number',
          label: 'Dot Trail',
          description: 'Trailing fade length behind each dot, fraction of segment.',
          min: 0,
          max: 0.45,
          step: 0.005,
        },
        'dot-alpha': {
          type: 'number',
          label: 'Dot Alpha',
          description:
            'Maximum opacity of dot trails. Values >1 over-saturate via lighter compositing.',
          min: 0,
          max: 1.5,
          step: 0.05,
        },
        'line-segment-density': {
          type: 'number',
          label: 'Line Segment Density',
          description: 'Lanes-per-line override. Defaults to dot-density when unset.',
          min: 1,
          max: 8,
          step: 1,
        },
        'ring-segment-density': {
          type: 'number',
          label: 'Ring Segment Density',
          description: 'Lanes-per-ring override. Defaults to min(2, dot-density) when unset.',
          min: 1,
          max: 8,
          step: 1,
        },
        'segment-width': {
          type: 'number',
          label: 'Segment Width',
          description: 'Width of the lit head along a line/ring, fraction of segment length.',
          min: 0.002,
          max: 0.25,
          step: 0.001,
        },
        'intersection-glow': {
          type: 'number',
          label: 'Intersection Glow (legacy)',
          description:
            'Legacy intersection-glow knob carried by some scenes. Currently ignored by the runtime; kept here so existing scenes do not orphan.',
          min: 0,
          max: 2,
          step: 0.01,
        },
        'pulse-offset': {
          type: 'number',
          label: 'Pulse Offset (legacy)',
          description:
            'Legacy phase-offset knob carried by some scenes. Currently ignored by the runtime; kept here so existing scenes do not orphan.',
          min: -1,
          max: 1,
          step: 0.01,
        },
      },
    },
    {
      id: 'sequence',
      label: 'Sequence Animation',
      description:
        'Tunables for the sequence pass — alternates scan and dot-field windows. Durations are in seconds.',
      properties: {
        'sequence-scan-duration': {
          type: 'number',
          label: 'Scan Duration (s)',
          description: 'Seconds per scan window in the sequence loop.',
          min: 0.1,
          max: 30,
          step: 0.1,
        },
        'sequence-dot-cycles': {
          type: 'number',
          label: 'Dot Cycles',
          description: 'Number of full dot-field cycles per dot window in the sequence loop.',
          min: 0.1,
          max: 10,
          step: 0.1,
        },
        'sequence-fade-duration': {
          type: 'number',
          label: 'Fade Duration (s)',
          description: 'Seconds of crossfade between scan and dot windows in the sequence loop.',
          min: 0,
          max: 5,
          step: 0.05,
        },
      },
    },
  ],
};
